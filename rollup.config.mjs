import { nodeResolve } from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { babel } from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import globby from 'fast-glob';
import path from 'path';
import terser from '@rollup/plugin-terser';
const extensions = ['.js', '.ts', '.jsx', '.tsx'];
const babelIncludes = ['./src/**/*'];
const bundleNpmWorkspacePackages = ['ws'];
const bundlePackages = ['restify-websocket/server', 'restify-websocket'];
const neverBundlePackages = ['typeorm'];
const shouldBundleLocalFilesTogether = true;
const shouldBundleNodeModules = false;
const isDevelopment = process.env.ROLLUP_WATCH;
const decorators = true;
const isProduction = process.env.NODE_ENV === 'production';
const isPackageDependency = (pkg, path, importer = '') => {
	return path.includes('/' + pkg + '/') || (importer.includes('/' + pkg + '/') && path.startsWith('.')) || path === pkg;
};
const getRollupConfig =
	({ isBrowser = false, format = 'esm' } = { isBrowser: false, format: 'esm' }) =>
	(localInput) => {
		const input = localInput;
		return {
			input,
			output: {
				file: path.join(
					'./dist',
					format,
					// isBrowser ? '' : 'server',
					localInput.replace('/src', '').replace(/\.(tsx|ts)/, format === 'cjs' ? '.js' : '.js')
				),
				format,
			},
			external(id, second = '') {
				const sanitizedId = id.split('?')[0];
				const isNodeModule = id.includes('node_modules');
				if (id.endsWith('.json')) return false;
				if (sanitizedId.endsWith(input.replace('./', '/'))) {
					return false;
				}
				// No need to pass second because the entry will be stopped
				if (neverBundlePackages.find((pkg) => isPackageDependency(pkg, id))) {
					return true;
				}
				if (bundlePackages.find((pkg) => isPackageDependency(pkg, id, second))) {
					return false;
				}
				if (
					!id.includes('node_modules') &&
					!second.includes('node_modules') &&
					bundleNpmWorkspacePackages.find((pkg) => id.includes('/' + pkg + '/') || second.includes('/' + pkg + '/'))
				) {
					return false;
				}

				if (isNodeModule) {
					return !shouldBundleNodeModules;
				}
				return !shouldBundleLocalFilesTogether;
			},
			plugins: [
				replace({
					preventAssignment: true,
					'process.env.NODE_ENV': `'${process.env.NODE_ENV}'`,
				}),
				json(),

				nodeResolve({
					extensions,
					preferBuiltins: true,

					browser: isBrowser ? true : false,
				}),
				commonjs(),

				peerDepsExternal(),
				babel({
					extensions,
					babelHelpers: 'bundled',
					include: babelIncludes,
				}),
				isDevelopment ? undefined : terser({ keep_fnames: decorators }),
			],
		};
	};
const inputs = [{ include: ['./src/index.ts', './src/run-server.ts'], name: 'server' }];

/**[
	{
		include: ['./src/**', '!./src/client/**'],
		entry: `./src/index.ts`,
		name: 'server',
	},
	{
		include: ['./src/client/**'],
		entry: `./src/client/index.ts`,
		name: 'server',
		browser: true,
	},
];
*/
const wow = inputs.reduce((acc, input) => {
	const files = globby.sync([...input.include, '!*.json'], {
		// cwd: process.env.FOLDER_PATH,
	});
	// const tempp = files.map((file) => path.join(process.env.FOLDER_PATH, file));
	const formats = ['cjs'];
	return [
		...acc,
		...formats.reduce((acc, format) => {
			return [...acc, ...files.map(getRollupConfig({ isBrowser: input.browser, format }))];
		}, []),
	];
}, []);
export default wow;
