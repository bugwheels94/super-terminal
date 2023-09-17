import express from 'express';
import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import path from 'path';
import { WebSocket } from 'ws';
import { SoxtendServer, InMemoryMessageDistributor, Router } from 'soxtend/server';
import { AppDataSource } from './data-source';
import { TerminalLog } from './entity/TerminalLog';
import { addProjectRoutes } from './routes/project';
import { addProjectSchellScriptRoutes } from './routes/projectShellScript';
import { addTerminalRoutes } from './routes/terminal';
import { initShellHistory, shellHistory } from './utils/shellHistory';
import { getConfig } from './utils/config';
// import ON_DEATH from 'death'; //this is intentionally ugly
// import { ptyProcesses } from './utils/pty';

export function main(port: number, bindAddress: string) {
	// fs.writeFileSync(path.join(__dirname, '.created_on_first_exec'), 'Hey there!');

	const app = express();

	const { finalConfig } = getConfig();
	// process.stdin.setRawMode(true);
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction || 1) {
		app.use(express.static(path.join(__dirname, '..', 'ui/dist')));
	}
	let httpServer: Server;
	if (finalConfig.KEY && finalConfig.CERT && !process.env.DEVELOPMENT) {
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

			const server = new SoxtendServer({
				noServer: true,

				distributor: new InMemoryMessageDistributor(),
			});
			const router = new Router(server);
			server.addListener('connection', (socket) => {
				server.joinGroup('global', socket);
			});
			server.addListener('ready', () => {
				const p = port || finalConfig.PORT;
				const b = bindAddress || finalConfig.BIND_ADDRESS;
				httpServer.listen(p, b, function listening() {
					console.log(`Running at ${b}:${p}`);
				});

				const { rawWebSocketServer } = server;
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
						server.rawWebSocketServer.emit('connection', ws, request);
					});
					// });
				});
				// whatever comes to below route should be passed to pty process

				addProjectRoutes(router);
				addTerminalRoutes(router);
				addProjectSchellScriptRoutes(router);
				async function cleanup() {
					// var date = new Date();
					// date.setDate(date.getDate() - 7);
					const qb = AppDataSource.getRepository(TerminalLog).createQueryBuilder('terminal_log');
					const unnecessaryRows = qb
						// .where('createdAt < :date', {
						// 	date,
						// })
						.where(
							'terminal_log.id NOT IN' +
								qb
									.subQuery()
									.select(['id'])
									.from(TerminalLog, 'terminal_log')
									.orderBy('createdAt', 'DESC')
									.limit(1000)
									.groupBy('terminalId')
									.addGroupBy('id')
									.getQuery()
						);
					const [selectQuery, params] = unnecessaryRows
						.select(['terminalId', 'log', 'createdAt'])

						.getQueryAndParameters();
					await AppDataSource.manager.query(
						`
					INSERT INTO terminal_log_archive(terminalId, log, createdAt)
					${selectQuery}
					`,
						params
					);
					await unnecessaryRows.delete().execute();
				}
				cleanup();
				setInterval(cleanup, 4 * 60 * 60 * 1000);
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
