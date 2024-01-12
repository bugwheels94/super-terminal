import yaml from 'js-yaml';
import { throttle, uniqBy } from 'lodash';
import { spawn } from 'node-pty';
import os from 'os';
import { ApiError, Router, RouterResponse } from 'soxtend/server';
import kill from 'tree-kill';
import { AppDataSource, ProjectRepository, TerminalLogRepository, TerminalRepository } from '../data-source';
import { Terminal } from '../entity/Terminal';
import { TerminalLog } from '../entity/TerminalLog';
import { ptyProcesses } from '../utils/pty';
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
export function createNewTerminal() {
	return {
		title: 'New Terminal',
		height: 250,
		width: 400,
		x: 0,
		y: 0,
	} as Terminal;
}
export const addTerminalRoutes = (router: Router) => {
	// socket.on('close', () => {
	// 	Object.values(ptyProcesses).forEach((ptyProcess) => {
	// 		ptyProcess.clients.delete(client);
	// 	});
	// });
	router.post('/projects/:id/terminals', async (req, res) => {
		const id = Number(req.params.id);
		const project = await ProjectRepository.findOneOrFail({
			where: { id },
		});
		const terminal = createNewTerminal();
		terminal.project = project;

		await TerminalRepository.save(terminal);
		createPtyTerminal({ terminal, res, projectId: id });
		res.group(id.toString()).status(200).send(terminal);
	});

	router.post('/projects/:projectId/terminals/:id/copies', async (req, res) => {
		const projectId = Number(req.params.projectId);
		const terminalId = Number(req.params.id);
		const oldTerminal = await TerminalRepository.findOneOrFail({
			where: {
				id: terminalId,
			},
		});
		const terminal = await TerminalRepository.save({
			...oldTerminal,
			...createNewTerminal(),
			id: undefined,
			title: oldTerminal.title + '-clone',
		});
		createPtyTerminal({ terminal, res, projectId });
		res.group(projectId.toString()).status(200).send(terminal);
	});
	router.patch('/projects/:projectId/terminals/:id', async (req, res) => {
		const { meta, restart, ...terminal } = req.body as PutTerminalRequest;
		const id = Number(req.params.id);
		const projectId = Number(req.params.projectId);
		if (restart) {
			killPtyProcess(id);
			const terminalRecord = await TerminalRepository.findOne({
				where: { id },
			});
			if (terminalRecord)
				createPtyTerminal({
					terminal: terminalRecord,
					res,
					meta,
					projectId,
				});
			return;
		}
		if (meta) {
			const processObject = ptyProcesses.get(id);
			if (!processObject) console.error('Process not found with id', id);
			else processObject.process.resize(meta.cols, meta.rows);
		}
		if (Object.keys(terminal).length === 0) return;
		if (terminal.startupEnvironmentVariables) {
			try {
				const doc = yaml.load(terminal.startupEnvironmentVariables, {
					schema: yaml.JSON_SCHEMA,
				});
				if (typeof doc !== 'object') throw new ApiError('Invalid YAML for startup Environment Variables', 400);
			} catch (e) {
				throw new ApiError('Invalid YAML for startup Environment Variables', 400);
			}
		}
		// This prevents from updating terminal object in the triggering app unnecessary.
		// Downside is other window will also be not aware of any move of terminal position
		// Ideal solution is to dispatch this x, y to other windows (except triggering) and update it there

		if (Object.keys(terminal).length) {
			await TerminalRepository.update(id, terminal);
		}
		res
			.group(projectId.toString())
			.status(200)
			.send(
				await TerminalRepository.findOneOrFail({
					where: {
						id,
					},
				})
			);

		// null means dont send response
	});
	router.delete('/projects/:projectId/terminals/:id', async (req, res) => {
		const id = Number(req.params.id);
		const projectId = Number(req.params.projectId);

		killPtyProcess(id);
		await TerminalRepository.delete(id);
		res.group(projectId.toString()).status(200).send();
	});
	router.get('/projects/:projectId/terminals', async (req, res) => {
		const id = Number(req.params.projectId);

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
					logs: logs.map(({ log }) => ({ log })),
				};
			})
		);
		project.terminals.forEach((terminal) => {
			createPtyTerminal({ terminal, res, projectId: id });
		});

		res.status(200).send(data);
		res
			.group('global')
			.status(200)
			.send(id, {
				url: '/projects/' + id + '/running-status',
				method: 'post',
			});
	});
	router.post('/terminal-command', async (req) => {
		const { terminalId, command } = req.body as {
			terminalId: number;
			command: string;
		};
		const processObject = ptyProcesses.get(terminalId);
		if (!processObject) return console.error('Process not found with id', terminalId);
		processObject.process.write(command);
		// null means dont send response
	});
	router.get('/terminals/:terminalId/terminal-commands/:query', async (req, res) => {
		const query = req.params.query as string;
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
		res.send(uniqBy(result, 'command'));
	});
};
function createPtyTerminal({
	terminal,
	res,
	meta,
	projectId,
}: {
	terminal: Terminal;
	res: RouterResponse;
	meta?: { rows: number; cols: number };
	projectId: number;
}) {
	if (ptyProcesses.get(terminal.id)) return;
	const shell = terminal.shell
		? terminal.shell
		: process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

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
	ptyProcess.onData((data) => {
		res.group(projectId.toString()).send(data, { url: `/terminals/${terminal.id}/terminal-data`, method: 'post' });
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
	ptyProcess.onData((data) => {
		chunk += data;
		saveChunk();
	});
	if (terminal.startupCommands) {
		ptyProcess.write(terminal.startupCommands + '\n');
	}
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
