import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? "3200");
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    headless: true,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `ENABLE_TEST_AUTH_ROUTES=1 npm run start -- -H 127.0.0.1 -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
