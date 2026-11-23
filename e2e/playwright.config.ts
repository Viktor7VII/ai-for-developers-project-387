import { defineConfig, devices } from '@playwright/test'

// Dedicated ports so a running dev server (8080 / 5173) doesn't interfere.
const BACKEND_PORT = 18080
const FRONTEND_PORT = 15173
const isWindows = process.platform === 'win32'

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
      // Real backend with a throwaway in-memory database.
      command: isWindows ? '.\\mvnw.cmd -q spring-boot:run' : './mvnw -q spring-boot:run',
      cwd: '../backend',
      url: `http://localhost:${BACKEND_PORT}/actuator/health`,
      env: {
        SERVER_PORT: String(BACKEND_PORT),
        CALENDAR_DB_URL: 'jdbc:h2:mem:e2e;DB_CLOSE_DELAY=-1',
      },
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Vite dev server proxying /api to the backend above.
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { BACKEND_URL: `http://localhost:${BACKEND_PORT}` },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
