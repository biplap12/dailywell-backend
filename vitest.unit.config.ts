import { defineConfig } from 'vitest/config';

/** Database-free subset: no MongoDB required. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit.test.ts', 'tests/smoke.nodb.test.ts'],
    setupFiles: ['tests/setupEnv.ts'],
    testTimeout: 30000,
  },
});
