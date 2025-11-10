import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
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
	external: ['@prisma/client'],
}); 

