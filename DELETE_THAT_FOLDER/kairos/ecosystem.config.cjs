module.exports = {
	apps: [
		{
			name: 'kairos-web',
			script: 'build/index.js',
			env: {
				NODE_ENV: 'production',
				HOST: '127.0.0.1',
				PORT: 3055
			}
		}
	]
};
