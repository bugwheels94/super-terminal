import { IPty } from 'node-pty';

export type ProcessObject = { process: IPty; currentCommand: string; projectId: number };
import type { IPtyForkOptions } from 'node-pty';
export const ptyProcesses: Map<number, ProcessObject> = new Map();

export const ptyOptions: IPtyForkOptions = {
	name: 'xterm-256color',
	cols: 80,
	rows: 30,
	cwd: process.cwd(),
	env: Object.assign(
		{},
		...Object.keys(process.env)
			.filter((key: string) => process.env[key] !== undefined)
			.map((key: string) => ({ [key]: process.env[key] }))
	),
};
