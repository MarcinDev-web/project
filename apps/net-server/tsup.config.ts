import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		server: 'src/server.ts',
	},
	outDir: 'dist',
	format: ['esm'],
	target: 'node22',
	platform: 'node',
	clean: true,
	sourcemap: true,
	minify: false,
	splitting: false,
	shims: false,
	dts: false,
	keepNames: true,
	skipNodeModulesBundle: true,
	// Keep prisma external due to native engines layout; everything else can be bundled
	// Also exclude Prisma runtime and custom output path
	external: [
		'@prisma/client',
		'@prisma/client/runtime/library',
		'../../node_modules/.prisma/net-client',
		'../../node_modules/.prisma/net-client/index.js',
	],
	noExternal: [], // Allow all node_modules to be external
}); 

