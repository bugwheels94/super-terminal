import 'reflect-metadata';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { DataSource } from 'typeorm';

import { Project } from './entity/Project';
import { Terminal } from './entity/Terminal';
import { TerminalLog } from './entity/TerminalLog';
import { TerminalLogArchive } from './entity/TerminalLogArchive';
import { TerminalSetting } from './entity/TerminalSetting';
import 'sqlite3';
import { TerminalCommand } from './entity/TerminalCommand';
const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
fs.mkdirSync(targetDir, { recursive: true });
export const AppDataSource = new DataSource({
	type: 'sqlite',
	database: path.join(targetDir, 'database.sqlite'),
	synchronize: true,
	logging: ['error'],
	entities: [Project, Terminal, TerminalSetting, TerminalLog, TerminalLogArchive, TerminalCommand],
	migrations: [],
	subscribers: [],
});
export const TerminalRepository = AppDataSource.getRepository(Terminal);
export const TerminalLogRepository = AppDataSource.getRepository(TerminalLog);
export const TerminalCommandRepository = AppDataSource.getRepository(TerminalCommand);
export const TerminalLogArchiveRepository = AppDataSource.getRepository(TerminalLogArchive);
export const ProjectRepository = AppDataSource.getRepository(Project);
