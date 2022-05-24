import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import os from 'os';
import path from 'path';

import { MessageData, WebSocketPlus } from '@lytejs/ws';
import express from 'express';
import yaml from 'js-yaml';
import { throttle } from 'lodash';
import { spawn } from 'node-pty';
import { IPty } from 'node-pty';
import { QueryFailedError } from 'typeorm';
import WebSocket from 'ws';

import { AppDataSource, ProjectRepository, TerminalRepository, TerminalLogRepository } from './data-source';
import { Project } from './entity/Project';
import { Terminal } from './entity/Terminal';
import { TerminalLog } from './entity/TerminalLog';
import config from './config.json';
const ptyProcesses: Record<number, { process: IPty }> = {};
const app = express();
export const readYAMLFile = (...fileName: string[]) => {
	try {
		return yaml.load(fs.readFileSync(path.join(...fileName), 'utf8'), {
			schema: yaml.JSON_SCHEMA,
		});
	} catch (e) {
		return {};
	}
};
export const readJSONFile = (...fileName: string[]) => {
	try {
		return JSON.parse(fs.readFileSync(path.join(...fileName), 'utf8'));
	} catch (e) {
		return {};
	}
};
const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
fs.mkdirSync(targetDir, { recursive: true });

// const config = readJSONFile(__dirname, 'config.json')
const finalConfig = {
	...config,
	...(readYAMLFile(targetDir, 'config') as Record<string, string>),
};
// process.stdin.setRawMode(true);
app.use(express.static(path.join(__dirname, '/snapshot/super-terminal-ui/dist')));
app.use('*', express.static(path.join(__dirname, 'node_modules/super-terminal-ui/dist/index.html')));
let server: Server;
if (finalConfig.KEY && finalConfig.CERT) {
	server = https.createServer(
		{
			cert: fs.readFileSync(finalConfig.CERT),
			key: fs.readFileSync(finalConfig.KEY),
		},
		app
	);
} else {
	server = http.createServer(app);
}
server.listen(finalConfig.PORT, function listening() {
	console.log('listening on  ');
});

AppDataSource.initialize()
	.then(async () => {
		const wss = new WebSocket.Server({ server });

		type PutProjectMessage = {
			type: 'PUT_PROJECT';
			projectSlug: string;
		};

		type Message =
			| {
					type: 'COMMAND' | 'REGISTER';
					data: string;
					terminalId: string;
			  }
			| {
					type: 'POST_TERMINAL';
			  }
			| {
					type: 'REMOVE_TERMINAL';
					terminalId: string;
			  }
			| PutProjectMessage
			| {
					type: 'PATCH_TERMINAL';
					title: string;
					terminalId: string;
			  };

		wss.on('connection', function connection(ws) {
			const terminalConnectionStore: Record<number, boolean> = {};
			async function connectTerminalToSocket({ terminal, ptyProcess }: { terminal: Terminal; ptyProcess: IPty }) {
				if (terminalConnectionStore[terminal.id]) return;
				ptyProcess.onData((data) => {
					client.post('/terminal-data', {
						body: {
							terminalId: terminal.id,
							data,
						},
						forget: true,
					});
				});
				terminalConnectionStore[terminal.id] = true;
			}
			async function createTerminal({ terminal }: { terminal: Terminal }) {
				const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

				let env = process.env as Record<string, string>;
				try {
					const doc = yaml.load(terminal.startupEnvironmentVariables, {
						schema: yaml.JSON_SCHEMA,
					}) as Record<string, string>;
					env = { ...env, ...doc };
				} catch (e) {
					throw new Error('Invalid YAML for startup Environment Variables');
				}
				const ptyProcess = spawn(shell, [], {
					name: 'xterm-color',
					cols: 80,
					rows: 30,
					cwd: terminal.cwd || process.env.HOME,
					env,
				});

				ptyProcesses[terminal.id] = {
					process: ptyProcess,
				};
				connectTerminalToSocket({
					terminal,
					ptyProcess,
				});
				let chunk = '';
				const saveChunk = throttle(() => {
					const terminalLog = new TerminalLog();

					terminalLog.terminal = terminal;
					// console.log("Writing", chunk);
					terminalLog.log = chunk;
					terminalLog.createdAt = new Date();
					chunk = '';
					TerminalLogRepository.save(terminalLog);
					// TerminalLogRepository.delete({
					//   terminal: terminal,

					// })
				}, 200);
				ptyProcess.onData((data) => {
					// console.log("Adding", data);
					chunk += data;
					saveChunk();
				});
				if (terminal.startupCommands) {
					ptyProcess.write(terminal.startupCommands + '\n');
				}
			}
			console.log('Connection made');
			const { client, router } = new WebSocketPlus(ws);

			router.get('/projects', async (req, res) => {
				const p = await getProjects();
				res.status(200).send(p as unknown as MessageData);
			});
			router.put('/project', async (req, res) => {
				const data = req.body;
				await putProject(data as { slug: string });
				res.status(200).send('OK');
			});
			router.post('/terminals', async (req, res) => {
				const { projectSlug } = req.body as {
					projectSlug: string;
					cwd: string;
				};
				const terminal = await postTerminal({ projectSlug });
				createTerminal({ terminal });
				res.status(200).send(terminal as unknown as MessageData);
			});
			function killPtyProcess(terminalId: number) {
				const ptyProcess = ptyProcesses[terminalId];
				if (ptyProcess) {
					ptyProcess.process.kill();
				}
				delete ptyProcesses[terminalId];
				delete terminalConnectionStore[terminalId];
			}
			router.delete('/terminals', async (req, res) => {
				const { id } = req.body as {
					id: number;
				};
				killPtyProcess(id);
				await deleteTerminal({ id });

				res.status(200).send('OK');
			});
			// whatever comes to below route should be passed to pty process
			router.post('/terminal-command', async (req, res) => {
				const { terminalId, command } = req.body as {
					terminalId: number;
					command: string;
				};
				const processObject = ptyProcesses[terminalId];
				if (!processObject) console.error('Process not found with id', terminalId);
				console.log('WRIGINT', command);
				processObject.process.write(command);
				// null means dont send response
				res.status(null).send('OK');
			});
			router.put('/terminals', async (req, res) => {
				const { id, meta, restart, ...terminal } = req.body as {
					restart?: true;
					id: number;
					meta?: {
						rows: number;
						cols: number;
					};
					height?: number;
					width?: number;
					title?: string;
					cwd?: string;
					x?: number;
					y?: number;
					mainCommand?: string;

					startupCommands?: string;
					startupEnvironmentVariables?: string;
				};
				if (restart) {
					killPtyProcess(id);
					const terminalRecord = await TerminalRepository.findOne({
						where: { id },
					});
					if (terminalRecord)
						createTerminal({
							terminal: terminalRecord,
						});
					res.send('OK');
					return;
				}
				if (meta) {
					const processObject = ptyProcesses[id];
					if (!processObject) console.error('Process not found with id', id);

					processObject.process.resize(meta.cols, meta.rows);
				}
				if (terminal.startupEnvironmentVariables) {
					try {
						const doc = yaml.load(terminal.startupEnvironmentVariables, {
							schema: yaml.JSON_SCHEMA,
						});
					} catch (e) {
						throw new Error('Invalid YAML for startup Environment Variables');
					}
				}
				if (Object.keys(terminal).length) {
					await TerminalRepository.update(id, terminal);
				}
				res.send('OK');

				// null means dont send response
			});

			router.get('/terminals', async (req, res) => {
				const slug = req.body as string;
				const data = (await getTerminals({ slug })) as Terminal[];
				// Create Old Terminals that were lost somehow from the data present in the disk DB
				data.forEach((terminal) => {
					if (ptyProcesses[terminal.id] !== undefined) {
						connectTerminalToSocket({
							terminal,
							ptyProcess: ptyProcesses[terminal.id].process,
						});
						return;
					}
					createTerminal({ terminal });
				});
				res.status(200).send(data as unknown as MessageData);
			});
		});
	})
	.catch((error) => console.log(error));

const putProject = async ({ slug }: { slug: string }) => {
	const project = new Project();
	project.slug = slug;
	try {
		await AppDataSource.manager.save(project);
	} catch (e) {
		if (e instanceof QueryFailedError && e.driverError.errno === 19) return;
		throw e;
	}
};
const postTerminal = async ({ projectSlug }: { projectSlug: string }) => {
	const project = await ProjectRepository.findOneOrFail({
		where: { slug: projectSlug },
	});
	const terminal = new Terminal();
	terminal.project = project;
	await AppDataSource.manager.save(terminal);
	return terminal;
};
const deleteTerminal = async ({ id }: { id: number }) => {
	return TerminalRepository.delete(id);
};
const getTerminals = async ({ slug }: { slug: string }) => {
	const r = await ProjectRepository.findOneOrFail({
		where: { slug: slug },
		relations: ['terminals', 'terminals.logs'],
	});
	return Promise.all(
		r.terminals.map(async (terminal) => {
			const logs = await TerminalLogRepository.find({
				where: {
					terminalId: terminal.id,
				},
				order: { createdAt: -1 },
				take: 100,
			});

			return {
				...terminal,
				logs: logs.map(({ log }) => ({ log })),
			};
		})
	);
};
const getProjects = async () => {
	const r = await ProjectRepository.find();
	return r;
};
console.log('Running');
