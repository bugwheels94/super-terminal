import path from 'path';
import os from 'os';
import config from '../config.json';
import fs from 'fs';

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
export const targetDir = path.join(os.homedir(), '.config', 'super-terminal');
export function getConfig() {
	fs.mkdirSync(targetDir, { recursive: true });
	const userConfig = readYAMLFile(targetDir, 'config') as typeof config;
	const finalConfig = {
		...config,
		...(readYAMLFile(targetDir, 'config') as Record<string, string>),
	};
	return { finalConfig, userConfig };
}
