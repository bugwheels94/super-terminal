import { IPty } from 'node-pty';

export type ProcessObject = { process: IPty; currentCommand: string };
import type { IPtyForkOptions } from 'node-pty';
export const ptyProcesses: Record<number, ProcessObject> = {};

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
