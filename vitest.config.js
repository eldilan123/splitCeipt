import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://www.splitceipt.app' }
    },
    include: ['tests/**/*.test.js']
  }
})
