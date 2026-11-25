import { defineConfig } from 'vite';

export default defineConfig({
  base: '/WTD/',
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
