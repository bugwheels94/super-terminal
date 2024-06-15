import path from 'path';
import { AppDataSource, ProjectRepository, ShellScriptRepository } from '../data-source';
import { ShellScript } from '../entity/ShellScript';
import { targetDir } from '../utils/config';
import fs from 'fs';
import { ptyProcesses } from '../utils/pty';
import { isWindows } from '../utils/config';
import { SoxtendServer, Socket, JsonObject } from 'soxtend/server';
type PatchShellScriptRequest = Partial<Omit<ShellScript, 'project' | 'terminal' | 'id' | 'createdAt'>>;
export const addProjectSchellScriptRoutes = async (server: SoxtendServer, socket: Socket, message: any) => {
	switch (message.name) {
		case 'post:script': {
			const id = Number(message.data.projectId);
			const project = await ProjectRepository.findOneOrFail({
				where: { id },
			});
			const shellScript = new ShellScript();
			if (project.slug) {
				shellScript.project = project;
			}
			shellScript.script = message.data.script;
			shellScript.parameters = message.data.parameters;
			shellScript.name = 'untitled-script';
			await AppDataSource.manager.save(shellScript);
			server.sendToGroup(
				id.toString(),
				JSON.stringify({
					name: 'response|post:script',
					data: {
						projectId: id,
						data: shellScript as unknown as JsonObject,
					},
				})
			);
			break;
		}
		case 'clone:script': {
			const id = Number(message.data.projectId);
			const scriptId = Number(message.data.scriptId);
			const script = await ShellScriptRepository.findOneOrFail({ where: { id: scriptId } });
			// @ts-ignore
			delete script.id;
			delete script.project;
			script.name = script.name + '-clone';
			await ShellScriptRepository.save(script);
			server.sendToGroup(
				id.toString(),
				JSON.stringify({
					data: { data: script as unknown as JsonObject, projectId: id },
					name: 'response|clone:script',
				})
			);
			break;
		}
		case 'execute:script': {
			const scriptId = Number(message.data.scriptId);
			const terminalId = Number(message.data.terminalId);
			const script = await ShellScriptRepository.findOneOrFail({ where: { id: scriptId } });
			const parameters: Record<string, string> = message.data.parameters || {};
			let content = script.script;
			for (let parameter in parameters) {
				content = content.replace(new RegExp(`{{${parameter}}}`, 'g'), parameters[parameter]);
			}
			const shell = isWindows ? '' : (process.env.SHELL || 'bash') + ' ';
			const scriptPath = path.join(targetDir, 'script-' + script.name.replace(' ', '') + (isWindows ? '.cmd' : ''));
			const shebang = isWindows ? '' : `#!${shell}\n`;
			fs.writeFileSync(scriptPath, `${shebang}${content}`);
			const newLine = isWindows ? '\r\n' : '\n';
			ptyProcesses.get(terminalId).process.write(`${shell}${scriptPath}${newLine}`);
			break;
		}
		case 'patch:script': {
			const id = Number(message.data.scriptId);
			const projectId = Number(message.data.projectId);
			const shellScript = message.data.script as PatchShellScriptRequest;
			await ShellScriptRepository.update(id, shellScript);
			server.sendToGroup(
				projectId.toString(),
				JSON.stringify({
					data: {
						data: (await ShellScriptRepository.findOneOrFail({ where: { id } })) as unknown as JsonObject,
						scriptId: id,
						projectId,
					},
					name: 'response|patch:script',
				})
			);

			break;
		}
		case 'get:scripts': {
			const id = Number(message.data);
			const data = await ShellScriptRepository.createQueryBuilder('shell_script')
				.select()
				.where('projectId = :id', { id })
				.orWhere('projectId is NULL')
				.getMany();
			socket.send(
				JSON.stringify({
					data: data as unknown as JsonObject,
					id: message.id,
				})
			);

			break;
		}
		case 'delete:script': {
			const id = Number(message.data.scriptId);
			const projectId = Number(message.data.projectId);
			await ShellScriptRepository.delete(id);
			server.sendToGroup(
				projectId.toString(),
				JSON.stringify({
					data: { scriptId: id, projectId },
					name: 'response|delete:script',
				})
			);
			break;
		}
	}
};
