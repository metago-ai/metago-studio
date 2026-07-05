import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置
 *
 * 注意：本项目 vite.config.ts 中 base='/studio/'（兼容 CloudBase 子目录部署），
 * 因此应用实际由 http://localhost:5173/studio/ 提供。
 * webServer.url 与各测试用例的导航路径都据此调整，确保测试可真实运行。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/studio/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
