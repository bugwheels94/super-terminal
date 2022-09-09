import { AppDataSource, ProjectRepository, TerminalRepository, TerminalLogRepository } from '../data-source';
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
		try {
			await AppDataSource.manager.save(project).catch((e) => console.log(e));
		} catch (e) {
			if (!(e instanceof QueryFailedError) || e.driverError.errno !== 19) {
				throw e;
			}
		}
		res.group.status(200).send(
			await ProjectRepository.findOneOrFail({
				where: {
					slug: params.projectSlug,
				},
			})
		);
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
