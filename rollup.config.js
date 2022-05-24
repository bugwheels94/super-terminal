import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';

import globby from 'fast-glob';
import path from 'path';
const extensions = ['.js', '.ts'];
const babelIncludes = ['./src/**/*'];
const configs = globby.sync(['./src/**', '!./src/**.json']);
const bundleNpmWorkspacePackages = ['ws'];
const bundlePackages = ['@lytejs/ws', 'isomorphic-ws'];
const neverBundlePackages = ['node-pty', '@babel/runtime', 'ws'];
const shouldBundleLocalFilesTogether = false;
const isPackageDependency = (pkg, path, importer) => {
	return path.includes('node_modules/' + pkg) || importer.includes('node_modules/' + pkg) || path === pkg;
};
const getRollupConfig =
	({ isBrowser = false } = {}) =>
	(input) => {
		return {
			input,
			output: {
				file: path.join('./dist', input.replace('/src', '').replace(/\.(tsx|ts)/, '.js')),
				format: 'cjs',
			},
			external(id, second = '') {
				const sanitizedId = id.split('?')[0];
				const isNodeModule = id.includes('node_modules');
				if (id.endsWith('.json')) return false;
				if (sanitizedId.endsWith(input.replace('./', '/'))) {
					return false;
				}
				if (neverBundlePackages.find((pkg) => isPackageDependency(pkg, id, second))) {
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
					return true;
				}

				return !shouldBundleLocalFilesTogether;
			},
			plugins: [
				json(),
				resolve({
					extensions,
				}),
				commonjs(),
				babel({
					extensions,
					babelHelpers: 'runtime',
					include: babelIncludes,
				}),
				// peerDepsExternal(),
			],
		};
	};
export default [...configs.map(getRollupConfig())];
