import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit, integration and offline eval tests. Everything runs in Node by default;
// component tests opt into jsdom with a `@vitest-environment jsdom` docblock.
// No test touches the network, the real database or the Anthropic API: those
// are mocked at the module boundary (see tests/helpers).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // PDF rendering (fitCvPdf) does several real renders per test.
    testTimeout: 30_000,
    env: {
      // Satisfies the Anthropic provider's key check; every model is mocked.
      ANTHROPIC_API_KEY: 'test-key',
    },
  },
});
