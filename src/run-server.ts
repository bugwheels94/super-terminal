import { main } from './index';
if (process.argv.length < 3) main(0, '');
else {
	const { spawnSync } = require('child_process');
	const path = require('path');
	spawnSync('npm', ['install'], {
		cwd: path.join(__dirname, '..'),
		shell: true,
		stdio: 'inherit',
	});

	spawnSync('npm', ['run', 'build:electron'], {
		cwd: path.join(__dirname, '..'),
		shell: true,
		stdio: 'inherit',
	});
	const packageJson = require('../package.json');

	spawnSync('mv', ['out/make/zip/darwin/arm64/*.zip', `out/SuperTerminal-apple-arm64-${packageJson.version}.zip`], {
		cwd: path.join(__dirname, '..'),
		shell: true,
		stdio: 'inherit',
	});
	spawnSync(
		'gh',
		[
			'release',
			'upload',
			'v' + packageJson.version,
			`out/SuperTerminal-apple-arm64-${packageJson.version}.zip`,
			'--repo',
			'bugwheels94/super-terminal',
		],
		{
			cwd: path.join(__dirname, '..'),
			shell: true,
			stdio: 'inherit',
		}
	);
}
