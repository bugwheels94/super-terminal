import { AppDataSource, ProjectRepository, TerminalRepository, TerminalLogRepository } from '../data-source';
import { Client, Router } from 'restify-websocket';
import { Terminal } from '../entity/Terminal';
import os from 'os';
import yaml from 'js-yaml';
import { IPty, spawn } from 'node-pty';
import { throttle } from 'lodash';
import { TerminalLog } from '../entity/TerminalLog';
import WebSocket from 'isomorphic-ws';
type ProcessObject = { process: IPty; clients: Set<Client> };
const ptyProcesses: Record<number, ProcessObject> = {};
type PutTerminalRequest = {
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
export const addTerminalRoutes = (router: Router, client: Client, socket: WebSocket) => {
	socket.on('close', () => {
		Object.values(ptyProcesses).forEach((ptyProcess) => {
			ptyProcess.clients.delete(client);
		});
	});
	router.post('/terminals', async (req, res) => {
		const { projectSlug } = req.body as {
			projectSlug: string;
			cwd: string;
		};
		const project = await ProjectRepository.findOneOrFail({
			where: { slug: projectSlug },
		});
		const terminal = new Terminal();
		terminal.project = project;
		await AppDataSource.manager.save(terminal);
		createPtyTerminal({ terminal, client });
		res.status(200).send(terminal);
	});
	router.post('/terminals/:id/copies', async (req, res) => {
		const oldTerminal = await TerminalRepository.findOneOrFail({
			where: {
				id: req.params.id as number,
			},
		});
		const insertResult = await TerminalRepository.insert({ ...oldTerminal, id: undefined });
		const terminal = await TerminalRepository.findOneOrFail({
			where: {
				id: insertResult.raw,
			},
		});
		createPtyTerminal({ terminal, client });
		res.status(200).send(terminal);
	});
	router.patch('/terminals/:id', async (req, res) => {
		const { meta, restart, ...terminal } = req.body as PutTerminalRequest;
		const id = req.params.id as number;
		if (restart) {
			killPtyProcess(id);
			const terminalRecord = await TerminalRepository.findOne({
				where: { id },
			});
			if (terminalRecord)
				createPtyTerminal({
					terminal: terminalRecord,
					client,
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
	router.delete('/terminals/:id', async (req, res) => {
		const id = req.params.id as number;
		killPtyProcess(id);
		await TerminalRepository.delete(id);
		res.status(200).send('OK');
	});
	router.get('/terminals', async (req, res) => {
		const slug = req.body as string;
		const project = await ProjectRepository.findOneOrFail({
			where: { slug: slug },
			relations: ['terminals'],
		});
		project.terminals.forEach((terminal) => {
			if (ptyProcesses[terminal.id] !== undefined) {
				connectTerminalToSocket({
					ptyProcessObject: ptyProcesses[terminal.id],
					client,
				});
				return;
			}
			createPtyTerminal({ terminal, client });
		});
		res.status(200).send(
			await Promise.all(
				project.terminals.map(async (terminal) => {
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
			)
		);
	});
	router.post('/terminal-command', async (req, res) => {
		const { terminalId, command } = req.body as {
			terminalId: number;
			command: string;
		};
		const processObject = ptyProcesses[terminalId];
		if (!processObject) console.error('Process not found with id', terminalId);
		processObject.process.write(command);
		// null means dont send response
		res.status(null).send('OK');
	});
};
async function createPtyTerminal({ terminal, client }: { terminal: Terminal; client: Client }) {
	const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

	let env = process.env as Record<string, string>;
	try {
		const doc = yaml.load(terminal.startupEnvironmentVariables, {
			schema: yaml.JSON_SCHEMA,
		}) as Record<string, string>;
		env = { ...doc };
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
	const ptyProcessObject = {
		process: ptyProcess,
		clients: new Set<Client>(),
	};
	ptyProcessObject.clients.add(client);
	ptyProcess.onData((data) => {
		ptyProcessObject.clients.forEach((c) => {
			c.post('/terminal-data', {
				body: {
					terminalId: terminal.id,
					data,
				},
				forget: true,
			});
		});
	});
	ptyProcesses[terminal.id] = ptyProcessObject;
	connectTerminalToSocket({
		ptyProcessObject,
		client,
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
async function connectTerminalToSocket({
	ptyProcessObject,
	client,
}: {
	ptyProcessObject: ProcessObject;
	client: Client;
}) {
	ptyProcessObject.clients.add(client);
}
function killPtyProcess(terminalId: number) {
	const ptyProcess = ptyProcesses[terminalId];
	if (ptyProcess) {
		ptyProcess.process.kill();
	}
	delete ptyProcesses[terminalId];
}
