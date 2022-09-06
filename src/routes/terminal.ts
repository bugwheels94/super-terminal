import {
	AppDataSource,
	ProjectRepository,
	TerminalRepository,
	TerminalLogRepository,
	TerminalCommandRepository,
} from '../data-source';
import { Router, RouterResponse } from 'restify-websocket';
import { Terminal } from '../entity/Terminal';
import os from 'os';
import yaml from 'js-yaml';
import { IPty, spawn } from 'node-pty';
import { throttle } from 'lodash';
import { TerminalLog } from '../entity/TerminalLog';
import { applyEscapeSequence } from '../utils/applyEscapeSequence';
import { TerminalCommand } from '../entity/TerminalCommand';
import { Raw } from 'typeorm';
type ProcessObject = { process: IPty; currentCommand: string };
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
export const addTerminalRoutes = (router: Router) => {
	// socket.on('close', () => {
	// 	Object.values(ptyProcesses).forEach((ptyProcess) => {
	// 		ptyProcess.clients.delete(client);
	// 	});
	// });
	router.put('/groups/:groupId', (req, res) => {
		res.socket['groupId'] = req.params.groupId;
		res.clients.add(res.socket);
	});
	router.post<{ projectSlug: string }>('/projects/:projectSlug/terminals', async (req, res) => {
		const { projectSlug } = req.params;
		const project = await ProjectRepository.findOneOrFail({
			where: { slug: projectSlug },
		});
		const terminal = new Terminal();
		terminal.project = project;
		await AppDataSource.manager.save(terminal);
		createPtyTerminal({ terminal, res });
		res.group.status(200).send(terminal);
	});
	router.post('/projects/:projectSlug/terminals/:id/copies', async (req, res) => {
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
		createPtyTerminal({ terminal, res });
		res.group.status(200).send(terminal);
	});
	router.patch('/projects/:projectSlug/terminals/:id', async (req, res) => {
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
					res,
				});
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
		res.group.status(200).send(
			await TerminalRepository.findOneOrFail({
				where: {
					id,
				},
			})
		);

		// null means dont send response
	});
	router.delete('/projects/:projectSlug/terminals/:id', async (req, res) => {
		const id = req.params.id as number;
		killPtyProcess(id);
		await TerminalRepository.delete(id);
		res.group.status(200);
	});
	router.get<{ projectSlug: string }>('/projects/:projectSlug/terminals', async (req, res) => {
		const slug = req.params.projectSlug;
		const project = await ProjectRepository.findOneOrFail({
			where: { slug: slug },
			relations: ['terminals'],
		});
		const data = await Promise.all(
			project.terminals.map(async (terminal) => {
				const time = new Date();
				const logs = await TerminalLogRepository.find({
					where: {
						terminalId: terminal.id,
					},
					order: { createdAt: -1 },
					take: 1000,
				});
				return {
					...terminal,
					logs: logs.map(({ log }) => ({ log })),
				};
			})
		);
		project.terminals.forEach((terminal) => {
			createPtyTerminal({ terminal, res });
		});

		res.status(200).send(data);
	});
	router.post('/terminal-command', async (req, res) => {
		const { terminalId, command } = req.body as {
			terminalId: number;
			command: string;
		};
		const processObject = ptyProcesses[terminalId];
		if (!processObject) console.error('Process not found with id', terminalId);
		// console.log(/[^\\]\r/g.exec(processObject.currentCommand));
		processObject.currentCommand += command;

		const result = applyEscapeSequence(processObject.currentCommand);

		if (result === 'UNKNOWN_COMMAND' || Array.isArray(result)) {
			processObject.currentCommand = '';
		}
		if (Array.isArray(result)) {
			result.forEach((command) => {
				const terminalCommand = new TerminalCommand();
				terminalCommand.terminalId = terminalId;
				terminalCommand.command = command;
				AppDataSource.manager.save(terminalCommand);
			});
		}

		// console.log(processObject.currentCommand.split(/\r/g));
		processObject.process.write(command);
		// null means dont send response
		res.status(null);
	});
	router.get('/terminals/:terminalId/terminal-commands/:query', async (req, res) => {
		const terminalId = Number(req.params.terminalId);
		const query = req.params.query as string;
		const commands = await TerminalCommandRepository.createQueryBuilder('terminal_command')
			.select('command')
			.where('terminalId=:terminalId AND command LIKE :command', {
				terminalId,
				command: `%${query.toLocaleLowerCase()}%`,
			})
			.distinct()
			// .distinctOn(['terminal_command.command'])
			.execute();
		res.send(commands);
		// null means dont send response
	});
};
function createPtyTerminal({ terminal, res }: { terminal: Terminal; res: RouterResponse }) {
	if (ptyProcesses[terminal.id]) return;
	const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

	let env = process.env as Record<string, string>;
	try {
		const doc = yaml.load(terminal.startupEnvironmentVariables, {
			schema: yaml.JSON_SCHEMA,
		}) as Record<string, string>;
		env = { ...(process.env as Record<string, string>), ...doc };
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
		currentCommand: '',
	};
	ptyProcess.onData((data) => {
		res.groupedClients.post(`/terminals/${terminal.id}/terminal-data`, {
			data,
		});
	});
	ptyProcesses[terminal.id] = ptyProcessObject;
	let chunk = '';
	const saveChunk = throttle(() => {
		const terminalLog = new TerminalLog();

		terminalLog.terminal = terminal;
		terminalLog.log = chunk;
		terminalLog.createdAt = new Date();
		chunk = '';
		TerminalLogRepository.save(terminalLog).catch(() => {});
	}, 200);
	ptyProcess.onData((data) => {
		chunk += data;
		saveChunk();
	});
	if (terminal.startupCommands) {
		ptyProcess.write(terminal.startupCommands + '\n');
	}
}
function killPtyProcess(terminalId: number) {
	const ptyProcess = ptyProcesses[terminalId];
	if (ptyProcess) {
		ptyProcess.process.kill();
	}
	delete ptyProcesses[terminalId];
}
