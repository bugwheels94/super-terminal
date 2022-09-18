import path from 'path';
import { Router } from 'restify-websocket';
import { AppDataSource, ProjectRepository, ShellScriptRepository } from '../data-source';
import { ShellScript } from '../entity/ShellScript';
import { targetDir } from '../utils/config';
import fs from 'fs';
import os from 'os';
import { ptyProcesses } from '../utils/pty';
import { isWindows } from '../utils/config';
type PatchShellScriptRequest = Partial<Omit<ShellScript, 'project' | 'terminal' | 'id' | 'createdAt'>>;
export const addProjectSchellScriptRoutes = (router: Router) => {
	router.post('/projects/:projectSlug/scripts', async (req, res) => {
		const { projectSlug } = req.params;
		const project = await ProjectRepository.findOneOrFail({
			where: { slug: projectSlug },
		});
		const shellScript = new ShellScript();
		shellScript.project = project;
		shellScript.script = req.body.script;
		shellScript.parameters = req.body.parameters;
		shellScript.name = 'untitled-script';
		await AppDataSource.manager.save(shellScript);
		res.group.status(200).send(shellScript);
	});
	router.post('/projects/:projectSlug/scripts/:scriptId/copies', async (req, res) => {
		const projectSlug = req.params.projectSlug;
		const scriptId = Number(req.params.scriptId);
		const script = await ShellScriptRepository.findOneOrFail({ where: { id: scriptId } });
		// @ts-ignore
		delete script.id;
		delete script.project;
		script.name = script.name + '-clone';
		await ShellScriptRepository.save(script);
		res.group.status(200).send(script);
	});
	router.post('/terminals/:terminalId/scripts/:scriptId/executions', async (req, res) => {
		const scriptId = Number(req.params.scriptId);
		const terminalId = Number(req.params.terminalId);
		const script = await ShellScriptRepository.findOneOrFail({ where: { id: scriptId } });
		const parameters: Record<string, string> = req.body || {};
		let content = script.script;
		for (let parameter in parameters) {
			content = content.replace(new RegExp(`_${parameter}_`, 'g'), parameters[parameter]);
		}
		const shell = isWindows ? '' : (process.env.SHELL || 'bash') + ' ';
		const scriptPath = path.join(targetDir, 'script-' + script.name.replace(' ', '') + (isWindows ? '.cmd' : ''));
		const shebang = isWindows ? '' : `#!${shell}\n`;
		fs.writeFileSync(scriptPath, `${shebang}${content}`);
		const newLine = isWindows ? '\r\n' : '\n';
		ptyProcesses[terminalId].process.write(`${shell}${scriptPath}${newLine}`);
	});
	router.patch('/projects/:projectSlug/scripts/:id', async (req, res) => {
		const id = Number(req.params.id);
		const shellScript = req.body as PatchShellScriptRequest;
		await ShellScriptRepository.update(id, shellScript);
		res.group.status(200).send(await ShellScriptRepository.findOneOrFail({ where: { id } }));
	});
	router.get('/projects/:projectSlug/scripts', async (req, res) => {
		const { id, projectSlug } = req.params;
		const data = await ShellScriptRepository.createQueryBuilder('shell_script')
			.select()
			.leftJoin('shell_script.project', 'project')
			.where('project.slug = :slug', { slug: projectSlug })
			.orWhere('projectId is NULL')
			.getMany();
		res.group.status(200).send(data);
	});
	router.delete('/projects/:projectSlug/scripts/:id', async (req, res) => {
		const id = Number(req.params.id);
		await ShellScriptRepository.delete(id);
		res.group.status(200);
	});
};
