import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});
