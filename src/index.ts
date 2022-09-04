import { RestifyWebSocket } from 'restify-websocket';
import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import tcpPortUsed from 'tcp-port-used';
import express from 'express';
import open from './utils/open';
import config from './config.json';
import { AppDataSource } from './data-source';
import { addProjectRoutes } from './routes/project';
import { addTerminalRoutes } from './routes/terminal';
import { TerminalLog } from './entity/TerminalLog';

export const readYAMLFile = (...fileName: string[]) => {
	const yaml = require('js-yaml');
	const path = require('path');
	const fs = require('fs');

	try {
		return yaml.load(fs.readFileSync(path.join(...fileName), 'utf8'), {
			schema: yaml.JSON_SCHEMA,
		});
	} catch (e) {
		return {};
	}
};
export const readJSONFile = (...fileName: string[]) => {
	const path = require('path');
	const fs = require('fs');

	try {
		return JSON.parse(fs.readFileSync(path.join(...fileName), 'utf8'));
	} catch (e) {
		return {};
	}
};
function getConfig() {
	const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
	fs.mkdirSync(targetDir, { recursive: true });
	const finalConfig = {
		...config,
		...(readYAMLFile(targetDir, 'config') as Record<string, string>),
	};
	return finalConfig;
}
export function main() {
	// fs.writeFileSync(path.join(__dirname, '.created_on_first_exec'), 'Hey there!');

	const app = express();

	const finalConfig = getConfig();
	// process.stdin.setRawMode(true);
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction || 1) {
		const p = require.resolve('super-terminal-ui').split('/dummy')[0];
		app.use(express.static(p));
		app.use('*', express.static(path.join(p, 'index.html')));
	}
	let httpServer: Server;
	if (finalConfig.KEY && finalConfig.CERT) {
		httpServer = https.createServer(
			{
				cert: fs.readFileSync(finalConfig.CERT),
				key: fs.readFileSync(finalConfig.KEY),
			},
			app
		);
	} else {
		httpServer = http.createServer(app);
	}
	httpServer.listen(finalConfig.PORT, finalConfig.BIND_ADDRESS, function listening() {
		console.log('Running on Port', finalConfig.PORT);
	});

	AppDataSource.initialize()
		.then(async () => {
			const restify = new RestifyWebSocket.Server({ noServer: true });
			const { clients, router, server } = restify;
			restify.addEventListener('connection', ({ client, socket }) => {
				socket.send(JSON.stringify({ put: '/fresh-connection' }));
			});
			httpServer.on('upgrade', function upgrade(request, socket, head) {
				// This function is not defined on purpose. Implement it with your own logic.
				// authenticate(request, function next(err, client) {
				// 	if (err || !client) {
				// 		socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
				// 		socket.destroy();
				// 		return;
				// 	}

				server.handleUpgrade(request, socket, head, function done(ws) {
					// @ts-ignore
					ws['groupId'] = request.url;
					server.emit('connection', ws, request);
				});
				// });
			});
			// whatever comes to below route should be passed to pty process

			addProjectRoutes(router);
			addTerminalRoutes(router);

			async function cleanup() {
				var date = new Date();
				date.setDate(date.getDate() - 7);
				const [selectQuery, params] = AppDataSource.manager
					.createQueryBuilder()
					.select(['terminalId', 'log', 'createdAt'])
					.from(TerminalLog, 'terminal_log')
					.where('createdAt < :date', {
						date,
					})
					.getQueryAndParameters();
				await AppDataSource.manager.query(
					`
			  INSERT INTO terminal_log_archive(terminalId, log, createdAt)
			  ${selectQuery}
			  `,
					params
				);
				await AppDataSource.manager
					.createQueryBuilder()
					.delete()
					.from(TerminalLog)
					.where('createdAt < :date', {
						date,
					})
					.execute();
				// AppDataSource.manager.query(`vacuum`);
			}
			cleanup();
			setInterval(cleanup, 24 * 60 * 60 * 1000);
		})
		.catch((error) => console.log(error));
}
const browsersMap = {
	// @ts-ignore

	chrome: open.apps.chrome,
	// @ts-ignore
	edge: open.apps.edge,
	// @ts-ignore
	firefox: open.apps.firefox,
};
function init() {
	const finalConfig = getConfig();

	tcpPortUsed.check(7001).then(
		function (inUse) {
			if (!inUse) {
				main();
			}
			tcpPortUsed.waitUntilUsed(7001).then(
				async function () {
					const browser = ['edge', 'chrome', 'firefox'].includes(finalConfig.BROWSER) ? finalConfig.BROWSER : 'chrome';

					await open.openApp(
						// @ts-ignore
						browsersMap[browser],
						{
							newInstance: true,
							arguments: ['--app=http://' + finalConfig.REMOTE_ADDRESS + ':7001', '--new-window'],
						}
					);
				},
				function (err) {
					console.log('Error:', err.message);
				}
			);
		},
		function (err) {
			console.log('Error:', err.message);
		}
	);
}
main();
