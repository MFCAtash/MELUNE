import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_WEB_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * These specs never talk to a real backend (see e2e/utils/mock-api.ts) —
 * only to the Next.js app itself — so all they need running is the web
 * app: `next dev` locally, or `next build && next start` in CI (see
 * .github/workflows/ci.yml). NEXT_PUBLIC_API_URL is pointed at a port
 * nothing else listens on, so every API call is guaranteed to go through
 * our `page.route` interception rather than accidentally reaching a
 * developer's local API.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Video is a CI-only debugging aid: it needs Playwright's bundled
    // ffmpeg, which `PLAYWRIGHT_CHANNEL=msedge` runs (no downloaded
    // browsers/ffmpeg) deliberately don't have.
    video: process.env.CI ? "retain-on-failure" : "off",
  },

  // `PLAYWRIGHT_CHANNEL=msedge` (or `chrome`) runs the suite against an
  // already-installed browser instead of Playwright's downloaded
  // Chromium — the escape hatch for environments where
  // `playwright install` is blocked (corporate proxies, some regions).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
    },
  ],

  // CI starts the app itself (`next build && next start &`) before
  // invoking `playwright test`, so it disables this block and just
  // waits on `baseURL` — see .github/workflows/ci.yml. Locally, this
  // spins up `next dev` automatically the first time you run
  // `npm run test:e2e`, and reuses it if it's already running.
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
