import express from 'express';
import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import path from 'path';
import { SoxtendServer } from 'soxtend/server';
import { InMemoryMessageDistributor } from 'soxtend/inMemoryDistributor';
import { AppDataSource } from './data-source';
import { TerminalLog } from './entity/TerminalLog';
import { addProjectRoutes } from './routes/project';
import { addProjectSchellScriptRoutes } from './routes/projectShellScript';
import { addTerminalRoutes } from './routes/terminal';
import { initShellHistory, shellHistory } from './utils/shellHistory';
import { getConfig } from './utils/config';
import WebSocket from 'ws';
export function main(port: number, host: string) {
	const app = express();
	const { finalConfig } = getConfig();
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction || 1) {
		app.use(express.static(path.join(__dirname, '..', 'ui', 'dist')));
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
			server.addListener('connection', (socket) => {
				socket.joinGroup('global');
				socket.on('message', (message: WebSocket.Data) => {
					let parsed: {
						namespace: string;
						name: string;
						data: any;
						id?: number;
					};
					if (message instanceof Buffer) parsed = JSON.parse(message.toString());
					else return;
					switch (parsed.namespace) {
						case 'project':
							addProjectRoutes(server, socket, parsed);
							break;
						case 'terminal':
							addTerminalRoutes(server, socket, parsed);
							break;
						case 'shell-script':
							addProjectSchellScriptRoutes(server, socket, parsed);
							break;
						default:
					}
				});
			});
			server.addListener('ready', () => {
				const p = port || finalConfig.PORT;
				const b = host || finalConfig.HOST;
				httpServer.listen(p, b, function listening() {
					console.log(`Running at ${b}:${p}`);
				});

				const { rawWebSocketServer } = server;
				httpServer.on('upgrade', function upgrade(request, socket, head) {
					rawWebSocketServer.handleUpgrade(request, socket, head, function done(ws: WebSocket) {
						server.rawWebSocketServer.emit('connection', ws, request);
					});
				});

				async function cleanup() {
					const qb = AppDataSource.getRepository(TerminalLog).createQueryBuilder('terminal_log');
					const unnecessaryRows = qb.where(
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
}
export { getConfig };
