import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
	root: './client',
	base: '/',
	build: {
		// Emit the client build to public so Worker serves from ./public
		outDir: '../public',
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			'@shared': '../shared',
			'@client': '../client',
			'@server': '../server',
		},
	},
	plugins: [
		cloudflare({
			// Configure the plugin to serve static assets from client/dist
			// and route API requests to the Worker
			workerEntrypoint: '../server/worker.ts',
			configPath: '../wrangler.jsonc',
		}),
	],
	server: {
		port: 5173,
		strictPort: true,
	},
	optimizeDeps: {
		include: ['phaser'],
	},
});
