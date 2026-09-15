import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 300_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    // The test captures its own named visual evidence at every important game
    // state. Full Playwright video/trace recording severely throttles software
    // WebGL on hosted runners and can turn a 20 s scenario into >2 minutes.
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    launchOptions: {
      args: [
        '--use-angle=swiftshader-webgl',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding'
      ]
    }
  },
  webServer: {
    command: 'VITE_BASE_PATH=/ npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173/',
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
