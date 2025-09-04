// ESLint v9 flat config (ESM) with TypeScript support
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
	// Ignore vendor and build output
	{
		ignores: ['node_modules/**', 'public/**'],
	},
	// Base config for TS/JS files
	{
		files: ['**/*.{ts,tsx,js}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			// Sensible defaults
			eqeqeq: ['warn', 'smart'],
			curly: 'warn',
			'no-console': 'off',
			// TS-specific
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
