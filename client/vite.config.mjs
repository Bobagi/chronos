import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_CHRONOS_BASE_URL = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	console.log('Loaded VITE_API_BASE_URL:', env.VITE_API_BASE_URL);

	const chronosTarget = (env.VITE_API_BASE_URL?.trim() || DEFAULT_CHRONOS_BASE_URL).replace(
		/\/+$/,
		''
	);
	const proxySecure = chronosTarget.startsWith('https://');

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			host: '0.0.0.0',
			port: 3055,
			https: {
				key: fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem')),
				cert: fs.readFileSync(path.resolve(__dirname, 'certs/localhost.pem'))
			},
			proxy: {
				'/game': {
					target: chronosTarget,
					changeOrigin: true,
					secure: proxySecure
				},
				'/auth': {
					target: chronosTarget,
					changeOrigin: true,
					secure: proxySecure
				},
				'/friends': {
					target: chronosTarget,
					changeOrigin: true,
					secure: proxySecure
				}
			}
		},
		test: {
			projects: [
				{
					extends: './vite.config.mjs',
					test: {
						name: 'client',
						environment: 'browser',
						browser: {
							enabled: true,
							provider: 'playwright',
							instances: [{ browser: 'chromium' }]
						},
						include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['src/lib/server/**'],
						setupFiles: ['./vitest-setup-client.ts']
					}
				},
				{
					extends: './vite.config.mjs',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
