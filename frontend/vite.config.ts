import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    // The API client uses relative URLs; in development they are forwarded to the backend.
    proxy: {
      '/api': backendUrl,
      '/actuator': backendUrl,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fixed time zone makes date and time formatting in tests deterministic.
    env: { TZ: 'UTC' },
  },
})
