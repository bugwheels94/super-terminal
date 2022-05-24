import 'reflect-metadata';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { DataSource } from 'typeorm';

import { Project } from './entity/Project';
import { Terminal } from './entity/Terminal';
import { TerminalLog } from './entity/TerminalLog';
import { TerminalSetting } from './entity/TerminalSetting';
const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
fs.mkdirSync(targetDir, { recursive: true });
export const AppDataSource = new DataSource({
	type: 'sqlite',
	database: path.join(targetDir, 'database.sqlite'),
	synchronize: true,
	logging: false,
	entities: [Project, Terminal, TerminalSetting, TerminalLog],
	migrations: [],
	subscribers: [],
});
export const TerminalRepository = AppDataSource.getRepository(Terminal);
export const TerminalLogRepository = AppDataSource.getRepository(TerminalLog);
export const ProjectRepository = AppDataSource.getRepository(Project);
