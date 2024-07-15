import { AppDataSource, ProjectRepository, TerminalLogArchiveRepository, TerminalRepository } from '../data-source';
import { Project } from '../entity/Project';
import { createNewTerminal, killPtyProcess } from './terminal';
import { ptyProcesses } from '../utils/pty';
import { JsonObject, Socket, SoxtendServer } from 'soxtend/server';
const defaultTheme = {
	name: 'Breeze',
	black: '#31363b',
	red: '#ed1515',
	green: '#11d116',
	yellow: '#f67400',
	blue: '#1d99f3',
	purple: '#9b59b6',
	cyan: '#1abc9c',
	white: '#eff0f1',
	brightBlack: '#7f8c8d',
	brightRed: '#c0392b',
	brightGreen: '#1cdc9a',
	brightYellow: '#fdbc4b',
	brightBlue: '#3daee9',
	brightPurple: '#8e44ad',
	brightCyan: '#16a085',
	brightWhite: '#fcfcfc',
	background: '#31363b',
	foreground: '#eff0f1',
	selectionBackground: '#eff0f1',
	cursorColor: '#eff0f1',
};
export const addProjectRoutes = async (server: SoxtendServer, socket: Socket, message: any) => {
	// Implement query parameters
	switch (message.name) {
		case 'delete:logs-archive': {
			const days = Number(message.data.days) || 7;
			var date = new Date();
			date.setDate(date.getDate() - days);
			await TerminalLogArchiveRepository.createQueryBuilder()
				.delete()
				.where('createdAt < :date', {
					date,
				})
				.execute();
			await AppDataSource.manager.query('vacuum');
			break;
		}
		case 'get:projects': {
			const p = await ProjectRepository.find();
			socket.send(
				JSON.stringify({
					data: p as unknown as JsonObject,
					id: message.id,
				})
			);
			break;
		}
		case 'post:project': {
			const body = message.data;
			const project = new Project();
			project.slug = body.slug;
			project.fontSize = body.fontSize;
			project.terminalTheme = body.terminalTheme;
			project.scrollback = body.scrollback;

			const query: Record<string, string | number> = {};
			const slug = body.slug;
			query.slug = slug;
			project.fontSize = 14;
			project.terminalTheme = defaultTheme;
			let projectRecord: Project;
			try {
				projectRecord = await ProjectRepository.findOneOrFail({
					where: query,
				});
			} catch (e) {
				await ProjectRepository.save(project);

				projectRecord = await ProjectRepository.findOneOrFail({
					where: query,
				});
				const terminal = createNewTerminal();
				terminal.project = projectRecord;
				await TerminalRepository.save(terminal);
			}
			socket.send(
				JSON.stringify({
					id: message.id,
				})
			);
			server.sendToGroup(
				'global',
				JSON.stringify({
					data: projectRecord as unknown as JsonObject,
					name: 'response|post:projects',
				})
			);
			break;
		}
		case 'put:project': {
			const slug = message.data || '';
			const project = new Project();
			const query: Record<string, string | number> = {};
			project.slug = slug;
			query.slug = slug;
			project.fontSize = 14;
			project.scrollback = 1000;
			project.terminalTheme = defaultTheme;
			let projectRecord: Project;
			try {
				projectRecord = await ProjectRepository.findOneOrFail({
					where: query,
				});
			} catch (e) {
				await ProjectRepository.save(project);

				projectRecord = await ProjectRepository.findOneOrFail({
					where: query,
				});
				const terminal = createNewTerminal();
				terminal.project = projectRecord;
				await TerminalRepository.save(terminal);
			}
			socket.send(JSON.stringify({ data: projectRecord.id, id: message.id }));
			break;
		}
		case 'delete:project': {
			const id = Number(message.data);
			closeProject(id);
			await ProjectRepository.delete(id);
			server.sendToGroup('global', JSON.stringify({ name: 'response|delete:project', data: id }));
			server.sendToGroup(
				'global',
				JSON.stringify({
					name: 'response|close:running-projects',
					data: id,
				})
			);
			break;
		}
		case 'get:project': {
			const id = Number(message.data);
			const projectRecord = await ProjectRepository.findOneOrFail({
				where: { id },
			});
			socket.joinGroup(`${id}`);

			socket.send(JSON.stringify({ data: projectRecord as unknown as JsonObject, id: message.id }));

			break;
		}
		case 'close:running-projects': {
			const id = Number(message.data);
			closeProject(id);
			server.sendToGroup(
				'global',
				JSON.stringify({
					name: 'response|close:running-projects',
					data: id,
				})
			);
			break;
		}
		case 'patch:project': {
			const id = Number(message.data.id);
			try {
				await ProjectRepository.update(id, message.data.project || {});
			} catch (e) {
				if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
					socket.send(
						JSON.stringify({
							error: 'Project with this name already exists',
							id: message.id,
						})
					);
				} else throw e;
				return;
			}
			server.sendToGroup(
				id.toString(),
				JSON.stringify({
					name: 'response|patch:project',
					data: (await ProjectRepository.findOneOrFail({ where: { id } })) as unknown as JsonObject,
				})
			);

			break;
		}
		case 'get:running-projects': {
			const projectIds = [];
			const map = {};
			ptyProcesses.forEach((process) => {
				if (map[process.projectId]) return;
				projectIds.push(process.projectId);
				map[process.projectId] = true;
			});

			socket.send(
				JSON.stringify({
					data: projectIds,
					id: message.id,
				})
			);
		}
	}
};
function closeProject(id: number) {
	ptyProcesses.forEach((process, terminalId) => {
		if (process.projectId !== id) return;
		killPtyProcess(terminalId);
	});
}
