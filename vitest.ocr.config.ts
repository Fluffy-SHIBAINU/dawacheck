import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true, include: ['tests/ocr/**/*.test.ts'], testTimeout: 120_000 },
});
