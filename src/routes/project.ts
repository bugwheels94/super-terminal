import { AppDataSource, ProjectRepository, TerminalLogArchiveRepository } from '../data-source';
import { Router } from 'restify-websocket';
import { Project } from '../entity/Project';
import { QueryFailedError } from 'typeorm';
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
	router.delete('/logs-archive/:days', async (req, res) => {
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

	router.get('/projects', async (req, res) => {
		const p = await ProjectRepository.find();
		// No need to send to all tabs as this is general request
		res.status(200).send(p);
	});
	router.put<{ projectSlug: string }>('/projects/:projectSlug', async ({ body, params }, res) => {
		const project = new Project();
		project.slug = params.projectSlug;
		project.fontSize = 14;
		project.terminalTheme = defaultTheme;
		let projectRecord: Project;
		try {
			projectRecord = await ProjectRepository.findOneOrFail({
				where: {
					slug: params.projectSlug,
				},
			});
		} catch (e) {
			await ProjectRepository.save(project);
			projectRecord = await ProjectRepository.findOneOrFail({
				where: {
					slug: params.projectSlug,
				},
			});
		}
		// VERY SLOW Constraint failure code
		// try {
		// 	await ProjectRepository.save(project);
		// } catch (e) {
		// 	if (!(e instanceof QueryFailedError) || e.driverError.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
		// 		throw e;
		// 	}
		// }
		res.group.status(200).send(projectRecord);
	});
	router.delete('/projects/:projectSlug', async (req, res) => {
		const slug = req.params.projectSlug as string;
		await ProjectRepository.delete({
			slug,
		});
		res.group.status(200);
	});

	router.patch<{ projectSlug: string }>('/projects/:projectSlug', async (req, res) => {
		const slug = req.params.projectSlug as string;
		const { fontSize, terminalTheme } = req.body;
		await ProjectRepository.update(
			{
				slug,
			},
			{ fontSize, terminalTheme }
		);
		res.group.status(200).send(await ProjectRepository.findOneOrFail({ where: { slug } }));
	});
};
