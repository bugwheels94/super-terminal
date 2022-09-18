import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import globby from 'fast-glob';
import path from 'path';
const extensions = ['.js', '.ts'];
const babelIncludes = ['./src/**/*'];
const configs = globby.sync(['./src/**', '!./src/**.json']);
const bundleNpmWorkspacePackages = ['ws'];
// Generally only put npm workspace packages here
const bundlePackages = ['restify-websocket'];
const neverBundlePackages = ['node-pty', 'ws', 'better-sqlite3', 'tcp-port-used', 'express', 'typeorm'];
const shouldBundleLocalFilesTogether = false;
const isDevelopment = !!process.env.ROLLUP_WATCH;
const isProduction = !isDevelopment;
const isPackageDependency = (pkg, path, importer = '') => {
	// Dont prefix with node_modules because it is only supposed to work in npm workspace
	return (
		path.includes('/' + pkg) ||
		path.includes('\\' + pkg) ||
		(importer.includes('\\' + pkg) && path.startsWith('.')) ||
		(importer.includes('/' + pkg) && path.startsWith('.')) ||
		path === pkg
	);
};
const getRollupConfig =
	({ isBrowser = false } = {}) =>
	(input) => {
		return {
			input,
			output: {
				file: path.join('./dist', input.replace('/src', '').replace(/\.(tsx|ts)/, '.js')),
				format: 'cjs',
				banner: input.endsWith('run-server.ts') ? '#!/usr/bin/env node' : undefined,
			},
			external(id, second = '') {
				const sanitizedId = id.split('?')[0];
				const isNodeModule = id.includes('node_modules') || second.includes('node_modules');
				const isLocalModule = id.startsWith('.');
				if (id.endsWith('.json')) return false;
				if (sanitizedId.endsWith(input.replace('./', '/'))) {
					return false;
				}
				// No need to pass second because the entry will be stopped
				if (neverBundlePackages.find((pkg) => isPackageDependency(pkg, id))) {
					console.log(id, 'External');
					return true;
				}
				if (bundlePackages.find((pkg) => isPackageDependency(pkg, id, second))) {
					return false;
				}
				if (
					!isNodeModule &&
					bundleNpmWorkspacePackages.find((pkg) => id.includes('/' + pkg + '/') || second.includes('/' + pkg + '/'))
				) {
					return false;
				}

				if (isLocalModule) {
					console.log(id, second, ':Local');
					return !shouldBundleLocalFilesTogether;
				}
				return false;
			},
			plugins: [
				replace({
					preventAssignment: true,

					'process.env.NODE_ENV': `'${process.env.NODE_ENV}'`,
				}),
				json(),
				resolve({
					extensions,
				}),
				commonjs(),
				babel({
					extensions,
					// babelHelpers: 'runtime',
					include: babelIncludes,
				}),
				peerDepsExternal(),
			],
		};
	};
export default [...configs.map(getRollupConfig())];
