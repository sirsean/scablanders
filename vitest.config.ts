import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Include test files from the shared directory
		include: ['shared/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		// Run tests once instead of watching
		watch: false,
		// Use Node.js environment for server-side utilities
		environment: 'node',
		// Enable coverage if needed
		coverage: {
			reporter: ['text', 'json', 'html'],
			include: ['shared/**/*.{js,ts}'],
			exclude: ['shared/**/*.{test,spec}.{js,ts}'],
		},
	},
	resolve: {
		alias: {
			'@shared': './shared',
			'@client': './client',
			'@server': './server',
		},
	},
});
