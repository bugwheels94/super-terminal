import { AppDataSource, ProjectRepository, TerminalRepository, TerminalLogRepository } from '../data-source';
import { Router } from 'restify-websocket';
import { Project } from '../entity/Project';
import { QueryFailedError } from 'typeorm';
const defaultTheme = {
	name: 'AtomOneLight',
	black: '#000000',
	red: '#de3e35',
	green: '#3f953a',
	yellow: '#d2b67c',
	blue: '#2f5af3',
	purple: '#950095',
	cyan: '#3f953a',
	white: '#bbbbbb',
	brightBlack: '#000000',
	brightRed: '#de3e35',
	brightGreen: '#3f953a',
	brightYellow: '#d2b67c',
	brightBlue: '#2f5af3',
	brightPurple: '#a00095',
	brightCyan: '#3f953a',
	brightWhite: '#ffffff',
	background: '#f9f9f9',
	foreground: '#2a2c33',
	selectionBackground: '#ededed',
	cursorColor: '#bbbbbb',
};
export const addProjectRoutes = (router: Router) => {
	router.get('/projects', async (req, res) => {
		const p = await ProjectRepository.find();
		res.status(200).send(p);
	});
	router.post('/projects', async ({ body }, res) => {
		const project = new Project();
		project.slug = body.slug;
		project.terminalTheme = defaultTheme;
		try {
			await AppDataSource.manager.save(project);
		} catch (e) {
			if (!(e instanceof QueryFailedError) || e.driverError.errno !== 19) {
				throw e;
			}
		}
		res.status(200).send(
			await ProjectRepository.findOneOrFail({
				where: {
					slug: body.slug,
				},
			})
		);
	});
	router.patch('/projects/:id', async (req, res) => {
		const id = req.params.id as number;
		const { fontSize, terminalTheme } = req.body;
		const project = new Project();
		project.id = id;
		project.fontSize = fontSize;
		project.terminalTheme = terminalTheme;
		await ProjectRepository.update(id, { fontSize, terminalTheme });
		res.status(200).send(await ProjectRepository.findOneOrFail({ where: { id } }));
	});
};
