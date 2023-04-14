import express from 'express';
import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import path from 'path';
import { WebSocket } from 'ws';
const { RestifyWebSocketServer, InMemoryMessageDistributor } = require('restify-websocket/server');
import { AppDataSource } from './data-source';
import { TerminalLog } from './entity/TerminalLog';
import { addProjectRoutes } from './routes/project';
import { addProjectSchellScriptRoutes } from './routes/projectShellScript';
import { addTerminalRoutes } from './routes/terminal';
import { initShellHistory, shellHistory } from './utils/shellHistory';
import { getConfig } from './utils/config';
// import ON_DEATH from 'death'; //this is intentionally ugly
// import { ptyProcesses } from './utils/pty';

export function main(port?: number) {
	// fs.writeFileSync(path.join(__dirname, '.created_on_first_exec'), 'Hey there!');

	const app = express();

	const { finalConfig } = getConfig();
	// process.stdin.setRawMode(true);
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction || 1) {
		const p = require.resolve('super-terminal-ui').split(/[/\\]dummy/)[0];
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

	AppDataSource.initialize()
		.then(async () => {
			initShellHistory();

			setInterval(() => {
				shellHistory();
			}, 30 * 1000);

			const restify = new RestifyWebSocketServer({
				noServer: true,

				distributor: new InMemoryMessageDistributor(),
			});
			restify.on('ready', () => {
				httpServer.listen(port || finalConfig.PORT, finalConfig.BIND_ADDRESS, function listening() {
					console.log('Running on Port', port || finalConfig.PORT);
				});

				const { router, rawWebSocketServer } = restify;
				// restify.addEventListener('connection', ({ socket }) => {
				// 	socket.project = socket.socket.groups[0];
				// 	socket.socket.send(JSON.stringify({ put: '/fresh-connection' }));
				// });
				httpServer.on('upgrade', function upgrade(request, socket, head) {
					// This function is not defined on purpose. Implement it with your own logic.
					// authenticate(request, function next(err, client) {
					// 	if (err || !client) {
					// 		socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
					// 		socket.destroy();
					// 		return;
					// 	}

					rawWebSocketServer.handleUpgrade(request, socket, head, function done(ws: WebSocket) {
						restify.emit('connection', ws, request);
					});
					// });
				});
				// whatever comes to below route should be passed to pty process

				addProjectRoutes(router);
				addTerminalRoutes(router);
				addProjectSchellScriptRoutes(router);
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
			});
		})
		.catch((error) => console.log(error));

	// ON_DEATH((signal, err) => {
	// 	Object.values(ptyProcesses).forEach(({ process: pty }) => {
	// 		console.log('KILLING');
	// 		// process.platform === 'win32' ? pty.kill() : pty.kill('SIGKILL');
	// 	});
	// 	process.exit();

	// 	//clean up code here
	// });
}
