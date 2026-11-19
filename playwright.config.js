import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localBaseUrl = 'http://127.0.0.1:4173';
const previewDirectory = process.env.PLAYWRIGHT_PREVIEW_DIR || 'dist-e2e';

export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results',
  timeout: 30_000,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-webgl']
    }
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: externalBaseUrl ? undefined : {
    command: `node node_modules/vite/bin/vite.js preview --outDir "${previewDirectory}" --host 127.0.0.1 --port 4173 --strictPort`,
    url: localBaseUrl,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI
  }
});
