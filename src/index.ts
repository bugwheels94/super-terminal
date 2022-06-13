import fs from 'fs';
import http, { Server } from 'http';
import https from 'https';
import os from 'os';
import path from 'path';

import { RestifyWebSocket } from 'restify-websocket';
import express from 'express';
import yaml from 'js-yaml';
import { IPty } from 'node-pty';
import WebSocket from 'ws';

import { AppDataSource } from './data-source';
import config from './config.json';
import { addProjectRoutes } from './routes/project';
import { addTerminalRoutes } from './routes/terminal';

const app = express();
export const readYAMLFile = (...fileName: string[]) => {
	try {
		return yaml.load(fs.readFileSync(path.join(...fileName), 'utf8'), {
			schema: yaml.JSON_SCHEMA,
		});
	} catch (e) {
		return {};
	}
};
export const readJSONFile = (...fileName: string[]) => {
	try {
		return JSON.parse(fs.readFileSync(path.join(...fileName), 'utf8'));
	} catch (e) {
		return {};
	}
};
const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
fs.mkdirSync(targetDir, { recursive: true });
// const config = readJSONFile(__dirname, 'config.json')
const finalConfig = {
	...config,
	...(readYAMLFile(targetDir, 'config') as Record<string, string>),
};
// process.stdin.setRawMode(true);
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction || 1) {
	const p = require.resolve('super-terminal-ui').split('/dummy')[0];
	app.use(express.static(p));
	app.use('*', express.static(path.join(p, 'index.html')));
}
let server: Server;
if (finalConfig.KEY && finalConfig.CERT) {
	server = https.createServer(
		{
			cert: fs.readFileSync(finalConfig.CERT),
			key: fs.readFileSync(finalConfig.KEY),
		},
		app
	);
} else {
	server = http.createServer(app);
}
server.listen(finalConfig.PORT, finalConfig.HOST_NAME, function listening() {
	console.log('Running on Port', finalConfig.PORT);
});

AppDataSource.initialize()
	.then(async () => {
		const wss = new WebSocket.Server({ server });

		wss.on('connection', function connection(ws) {
			const { client, router } = new RestifyWebSocket(ws);
			client.put('/fresh-connection');

			// whatever comes to below route should be passed to pty process

			addProjectRoutes(router);
			addTerminalRoutes(router, client);
		});
	})
	.catch((error) => console.log(error));
