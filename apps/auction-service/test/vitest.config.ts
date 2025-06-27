import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } }), , tsconfigPaths()],
  test: {
    globals: true,
    pool: 'threads',
    fileParallelism: false,
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
        isolate: false,
      },
    },
    environment: 'node',
    include: ['apps/auction-service/test/*.e2e-spec.ts'],
    setupFiles: ['apps/auction-service/test/vitest.setup.ts'],
  },
});
