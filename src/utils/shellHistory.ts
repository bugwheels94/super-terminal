import os from 'os';
import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import { chunk, uniq } from 'lodash';
import { AppDataSource, HistoryHashRepository } from '../data-source';
import crypto from 'crypto';
import { HistoryHash } from '../entity/HistoryHash';
const sha1 = (path: string) => {
	const hash = crypto.createHash('sha1');
	hash.update(path);
	return hash.digest('hex');
};
export function parseShellHistory(string: string) {
	const reBashHistory = /^: \d+:0;/;

	return string
		.trim()
		.split('\n')
		.map((line) => {
			if (reBashHistory.test(line)) {
				return line.split(';').slice(1).join(';');
			}

			// ZSH just places one command on each line
			return line;
		});
}

export function shellHistoryPath({ extraPaths = [] } = {}) {
	const homeDir = os.homedir();

	const paths = new Set([
		path.join(homeDir, '.history'),
		path.join(homeDir, '.bash_history'),
		path.join(homeDir, '.zsh_history'),
	]);
	if (process.env.HISTFILE) {
		paths.add(process.env.HISTFILE);
	}

	const notExistingPaths = new Set<string>();
	for (const path of paths) {
		if (!fs.existsSync(path)) {
			notExistingPaths.add(path);
		}
	}

	for (const path of notExistingPaths) {
		paths.delete(path);
	}

	return paths;
}

export async function shellHistory(options = {}) {
	const historyPaths = shellHistoryPath(options);
	if (historyPaths.size) {
		historyPaths.forEach(async (value, key) => {
			const content = fs.readFileSync(value, 'utf8');
			const hash = sha1(content);

			const hashRecord = await HistoryHashRepository.findOne({
				where: {
					path: value,
				},
			});
			if (!hashRecord || hashRecord?.hash !== hash) {
				const historyHash = new HistoryHash();
				if (hashRecord) historyHash.id = hashRecord.id;
				historyHash.path = value;
				historyHash.hash = hash;
				const result = await HistoryHashRepository.save(historyHash);
				updateShellHistoryInDB(uniq(parseShellHistory(content)), result.id);
			}
		});
	}
	if (process.platform === 'win32') {
		const { stdout } = childProcess.spawnSync('doskey', ['/history'], { encoding: 'utf8' });
		return updateShellHistoryInDB(uniq(stdout.trim().split('\r\n')), -1);
	}
}
export async function updateShellHistoryInDB(commands: string[], historyFileId: number) {
	const chunks = chunk(commands, 500);
	for (var i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		let string = `(?, ${historyFileId})`;
		for (let j = 0; j < chunk.length - 1; j++) {
			string += `,(?, ${historyFileId})`;
		}
		await AppDataSource.manager
			.query(`DELETE FROM terminal_history WHERE historyFileId = ?`, [historyFileId])
			.catch((e) => {
				console.log('failed', e);
			});

		await AppDataSource.manager
			.query(`INSERT INTO terminal_history(command, historyFileId) VALUES${string}`, chunks[i])
			.catch((e) => {
				console.log('failed', e);
			});
	}
}
export const initShellHistory = async () => {
	await AppDataSource.manager
		.query(`CREATE VIRTUAL TABLE IF NOT EXISTS terminal_history USING fts5(command, historyFileId)`)
		.catch((e) => {
			console.log('failed', e);
		});
	shellHistory();
};
