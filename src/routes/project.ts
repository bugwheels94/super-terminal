import { AppDataSource, ProjectRepository, TerminalLogArchiveRepository, TerminalRepository } from '../data-source';
import { Router } from 'soxtend/server';
import { Project } from '../entity/Project';
import { getNewFullSizeTerminal } from './terminal';
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
export const addProjectRoutes = (router: Router) => {
	// Implement query parameters
	router.delete('/logs-archive/:days', async (req) => {
		const days = Number(req.params.days) || 7;
		var date = new Date();
		date.setDate(date.getDate() - days);
		await TerminalLogArchiveRepository.createQueryBuilder()
			.delete()
			.where('createdAt < :date', {
				date,
			})
			.execute();
		await AppDataSource.manager.query('vacuum');
		// No need to send to all tabs as this is general request
	});

	router.get('/projects', async (_req, res) => {
		const p = await ProjectRepository.find();
		// No need to send to all tabs as this is general request
		res.status(200).send(p);
	});
	router.post('/projects', async ({ body }, res) => {
		const project = new Project();
		project.slug = body.slug;
		project.fontSize = body.fontSize;
		project.terminalTheme = body.terminalTheme;

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
			const terminal = getNewFullSizeTerminal();
			terminal.project = projectRecord;
			await TerminalRepository.save(terminal);
		}
		// VERY SLOW Constraint failure code
		// try {
		// 	await ProjectRepository.save(project);
		// } catch (e) {
		// 	if (!(e instanceof QueryFailedError) || e.driverError.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
		// 		throw e;
		// 	}
		// }
		res.send(projectRecord);
		res.group('global').send(projectRecord);
	});
	router.put('/projects/:projectSlug/:id?', async ({ params }, res) => {
		const project = new Project();
		const query: Record<string, string | number> = {};
		const id = Number(params.id);
		const slug = params.projectSlug;
		if (id) {
			project.id = id;
			query.id = id;
		} else {
			project.slug = slug;
			query.slug = slug;
		}
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
			const terminal = getNewFullSizeTerminal();
			terminal.project = projectRecord;
			await TerminalRepository.save(terminal);
		}
		// VERY SLOW Constraint failure code
		// try {
		// 	await ProjectRepository.save(project);
		// } catch (e) {
		// 	if (!(e instanceof QueryFailedError) || e.driverError.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
		// 		throw e;
		// 	}
		// }
		res.send(projectRecord);
	});
	router.delete('/projects/:id', async (req, res) => {
		const id = Number(req.params.id);
		await ProjectRepository.delete(id);
		res.group('global').status(200).send();
	});

	router.patch('/projects/:id', async (req, res) => {
		const id = Number(req.params.id);
		await ProjectRepository.update(id, req.body || {});
		res
			.status(200)
			.send({})
			.group(id.toString())
			.status(200)
			.send(await ProjectRepository.findOneOrFail({ where: { id } }));
	});
};
