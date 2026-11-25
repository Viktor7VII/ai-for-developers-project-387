import { defineConfig, devices } from '@playwright/test'

// Dedicated ports so a running dev server (8080 / 5173) doesn't interfere.
const BACKEND_PORT = 18080
const FRONTEND_PORT = 15173

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Real backend with a throwaway in-memory database. Maven comes from mise (as in `mise run check`):
      // the Maven Wrapper would download its own Maven distribution on every fresh CI runner, a
      // single-attempt network step that made the browser scenario fail intermittently.
      command: 'mvn -q spring-boot:run',
      cwd: '../backend',
      url: `http://localhost:${BACKEND_PORT}/actuator/health`,
      env: {
        SERVER_PORT: String(BACKEND_PORT),
        CALENDAR_DB_URL: 'jdbc:h2:mem:e2e;DB_CLOSE_DELAY=-1',
      },
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      // Maven prints its errors to stdout, which Playwright drops by default: without it a failed start in
      // CI shows only "Exit code: 1". Both streams go to the log, prefixed with [WebServer].
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Vite dev server proxying /api to the backend above.
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { BACKEND_URL: `http://localhost:${BACKEND_PORT}` },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
