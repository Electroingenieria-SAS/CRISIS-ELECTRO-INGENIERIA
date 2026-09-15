import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH
    ?? (process.env.GITHUB_ACTIONS === 'true' ? '/CRISIS-ELECTRO-INGENIERIA/' : '/'),
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
