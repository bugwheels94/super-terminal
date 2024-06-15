import yaml from 'js-yaml';
import { debounce, throttle, uniqBy } from 'lodash';
import { spawn } from 'node-pty';
import os from 'os';
import kill from 'tree-kill';
import { AppDataSource, ProjectRepository, TerminalLogRepository, TerminalRepository } from '../data-source';
import { Terminal } from '../entity/Terminal';
import { TerminalLog } from '../entity/TerminalLog';
import { ptyProcesses } from '../utils/pty';
import { JsonObject, Socket, SoxtendServer } from 'soxtend/server';
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
	shell?: string;
	startupCommands?: string;
	startupEnvironmentVariables?: string;
};
export function createNewTerminal(terminal?: Partial<Terminal>) {
	return {
		title: 'New Terminal',
		height: 250,
		width: 400,
		x: 0,
		y: 0,
		...terminal,
	} as Terminal;
}
export const addTerminalRoutes = async (server: SoxtendServer, socket: Socket, message: any) => {
	switch (message.name) {
		case 'post:terminal': {
			const id = Number(message.data.projectId);
			const project = await ProjectRepository.findOneOrFail({
				where: { id },
			});
			const terminal = createNewTerminal(message.data.terminal);
			terminal.project = project;

			await TerminalRepository.save(terminal);
			createPtyTerminal({ terminal, server, projectId: id });
			server.sendToGroup(
				id.toString(),
				JSON.stringify({
					data: { terminal, projectId: id } as unknown as JsonObject,
					name: 'response|post:terminal',
				})
			);

			break;
		}
		case 'clone:terminal': {
			const projectId = Number(message.data.projectId);
			const terminalId = Number(message.data.id);
			const oldTerminal = await TerminalRepository.findOneOrFail({
				where: {
					id: terminalId,
				},
			});
			const terminal = await TerminalRepository.save({
				...oldTerminal,
				...createNewTerminal(message.data.terminal),
				id: undefined,
				title: oldTerminal.title + '-clone',
			});
			createPtyTerminal({ terminal, server, projectId });
			server.sendToGroup(
				projectId.toString(),
				JSON.stringify({
					name: 'response|post:terminal',
					data: { terminal, projectId } as unknown as JsonObject,
				})
			);

			break;
		}
		case 'patch:terminal': {
			const { meta, restart, ...terminal } = message.data.terminal as PutTerminalRequest;
			const id = Number(message.data.id);
			const projectId = Number(message.data.projectId);
			if (restart) {
				killPtyProcess(id);
				const terminalRecord = await TerminalRepository.findOne({
					where: { id },
				});
				if (terminalRecord)
					createPtyTerminal({
						terminal: terminalRecord,
						server,
						meta,
						projectId,
					});
				return;
			}
			if (meta) {
				const processObject = ptyProcesses.get(id);
				if (!processObject) console.error('Process not found with id', id);
				else processObject.process.resize(meta.cols, meta.rows);
				return;
			}
			if (Object.keys(terminal).length === 0) return;
			if (terminal.startupEnvironmentVariables) {
				try {
					const doc = yaml.load(terminal.startupEnvironmentVariables, {
						schema: yaml.JSON_SCHEMA,
					});
					if (typeof doc !== 'object') throw new Error('Invalid YAML for startup Environment Variables');
				} catch (e) {
					throw new Error('Invalid YAML for startup Environment Variables');
				}
			}
			// This prevents from updating terminal object in the triggering app unnecessary.
			// Downside is other window will also be not aware of any move of terminal position
			// Ideal solution is to dispatch this x, y to other windows (except triggering) and update it there

			if (Object.keys(terminal).length) {
				await TerminalRepository.update(id, terminal);
			}
			server.sendToGroup(
				projectId.toString(),
				JSON.stringify({
					name: 'response|patch:terminal',
					data: {
						terminal: await TerminalRepository.findOneOrFail({
							where: {
								id,
							},
						}),
						projectId,
						terminalId: id,
					} as unknown as JsonObject,
				})
			);

			break;
		}
		case 'delete:terminal': {
			const id = Number(message.data.id);
			const projectId = Number(message.data.projectId);

			killPtyProcess(id);
			await TerminalRepository.delete(id);
			server.sendToGroup(
				projectId.toString(),
				JSON.stringify({
					name: 'response|delete:terminal',
					data: { terminalId: id, projectId },
				})
			);

			break;
		}
		case 'get:terminals': {
			const id = Number(message.data);

			const project = await ProjectRepository.findOneOrFail({
				where: { id },
				relations: ['terminals'],
			});
			const data = await Promise.all(
				project.terminals.map(async (terminal) => {
					const logs = await TerminalLogRepository.find({
						where: {
							terminalId: terminal.id,
						},
						order: { createdAt: -1 },
						take: project.numberOfLogsToRestore,
					});
					return {
						...terminal,
						logs: logs.reverse().map(({ log }) => ({ log })),
					};
				})
			);
			project.terminals.forEach((terminal) => {
				createPtyTerminal({ terminal, server, projectId: id });
			});

			socket.send(
				JSON.stringify({
					data: data as unknown as JsonObject,
					id: message.id,
				})
			);
			server.sendToGroup(
				'global',
				JSON.stringify({
					name: 'response|post:running-projects',
					data: id,
				})
			);

			break;
		}
		case 'post:terminal-command': {
			const { terminalId, command } = message.data as {
				terminalId: number;
				command: string;
			};
			const processObject = ptyProcesses.get(terminalId);
			if (!processObject) return console.error('Process not found with id', terminalId);
			processObject.process.write(command);

			break;
		}
		case 'get:terminal-commands': {
			const query = message.data as string;
			const chunks = query
				.trim()
				.split(/[\s-.]/)
				.filter((v) => v);
			const finalQuery = chunks.map((v) => `"${v}"*`).join(' OR ');
			const result = (await AppDataSource.manager
				.query(`SELECT * FROM terminal_history WHERE terminal_history MATCH ? ORDER BY rank LIMIT 10;`, [finalQuery])
				.catch((e) => {
					console.log('failed', e);
				})) as { command: string }[];
			socket.send(JSON.stringify({ data: uniqBy(result, 'command'), id: message.id }));

			break;
		}
	}
};
function createPtyTerminal({
	terminal,
	server,
	meta,
	projectId,
}: {
	terminal: Terminal;
	server: SoxtendServer;
	meta?: { rows: number; cols: number };
	projectId: number;
}) {
	if (ptyProcesses.get(terminal.id)) return;
	const shell = terminal.shell
		? terminal.shell
		: process.env.SHELL || os.userInfo().shell || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

	let env = process.env as Record<string, string>;
	if (terminal.startupEnvironmentVariables)
		try {
			const doc = yaml.load(terminal.startupEnvironmentVariables, {
				schema: yaml.JSON_SCHEMA,
			}) as Record<string, string>;
			env = { ...(process.env as Record<string, string>), ...doc };
		} catch (e) {
			console.log(e);
		}
	let cwd = terminal.cwd;
	if (cwd) {
		const envVariableInCwd = cwd.match(/\$[A-Za-z0-9_]+/g);
		cwd =
			envVariableInCwd?.reduce((acc, variable) => {
				const variableWithout$ = variable.substring(1);
				return acc.replace(variable, process.env[variableWithout$] || '');
			}, cwd) || cwd;
	}
	const ptyProcess = spawn(shell, [], {
		name: 'xterm-256color',
		cols: meta?.cols || 80,
		rows: meta?.rows || 30,
		cwd: cwd || process.env.HOME,
		env,
	});
	const ptyProcessObject = {
		process: ptyProcess,
		currentCommand: '',
		projectId,
	};
	let isReady = false;
	const executeStartupCommands = debounce(() => {
		if (terminal.startupCommands) {
			ptyProcess.write(terminal.startupCommands + '\n');
		}
		isReady = true;
	}, 200);
	ptyProcess.onData((data) => {
		server.sendToGroup(
			projectId.toString(),
			JSON.stringify({ data: { data, id: terminal.id }, name: `terminal-data` })
		);
		chunk += data;
		saveChunk();
		if (!isReady) {
			executeStartupCommands();
		}
	});
	ptyProcesses.set(terminal.id, ptyProcessObject);
	let chunk = '';
	const saveChunk = throttle(() => {
		const terminalLog = new TerminalLog();

		terminalLog.terminal = terminal;
		terminalLog.log = chunk;
		terminalLog.createdAt = new Date();
		chunk = '';

		TerminalLogRepository.save(terminalLog).catch(() => {});
	}, 200);
}
export function killPtyProcess(terminalId: number) {
	const ptyProcess = ptyProcesses.get(terminalId);
	if (ptyProcess) {
		try {
			kill(ptyProcess.process.pid);
			// ptyProcess.process.kill();
		} catch (e) {
			console.log('error', e);
		}
	}
	ptyProcesses.delete(terminalId);
}
