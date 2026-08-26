import { defineConfig } from "../../frontend/node_modules/@playwright/test";

if (
  process.env.CANDIDATE_ACCEPTANCE !== "1" ||
  process.env.ACCEPTANCE_BASE_URL !== "http://server:8000"
) {
  throw new Error(
    "Acceptance browser tests require the internal Docker server URL",
  );
}

export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  timeout: 90_000,
  retries: 0,
  outputDir: "deploy/acceptance/results/test-results",
  use: {
    baseURL: "http://server:8000",
    trace: "off",
    video: "off",
  },
});
