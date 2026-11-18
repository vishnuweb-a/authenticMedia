import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The default (cores - 1) forks starve each other's module RPC, so random
    // tests overrun the 5s budget; half the cores is stable and faster.
    maxWorkers: '50%',
    include: ['api/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
