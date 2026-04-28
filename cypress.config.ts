import { defineConfig } from 'cypress';

export default defineConfig({
  video: true,
  screenshotsFolder: 'cypress/screenshots',
  videosFolder: 'cypress/videos',
  chromeWebSecurity: false,
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://127.0.0.1:3000',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: false,
  },
});
