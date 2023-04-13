const webpack = require('webpack');
module.exports = {
	webpack: {
		plugins: {
			add: [
				new webpack.ProvidePlugin({
					Buffer: ['buffer', 'Buffer'],
				}),
			],
			// add: [new NodePolyfillPlugin()] /* An array of plugins */,
		},
		configure: {
			resolve: {
				fallback: {
					fs: require.resolve('browserify-fs'),
					stream: require.resolve('stream-browserify'),
					path: require.resolve('path-browserify'),
					os: require.resolve('os-browserify/browser'),
					buffer: require.resolve('buffer'),
				},
			},
		},
	},
};
