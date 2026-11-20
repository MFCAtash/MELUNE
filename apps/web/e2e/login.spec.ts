import { test, expect } from "@playwright/test";
import { installApiMocks, makeUser } from "./utils/mock-api";

const EMAIL = "listener@example.com";
const PASSWORD = "correct-horse-battery-staple";

test.describe("login", () => {
  test("logs in with valid credentials and lands on /home", async ({ page }) => {
    const user = makeUser({ email: EMAIL, username: "listener" });

    // `state.user` starts unset (nobody is "logged in" yet). The base
    // mock's own POST /auth/login handler already checks
    // `state.credentials`; this test just needs to flip `state.user` on
    // a successful attempt, so the very next GET /users/me (fired by
    // the app's own auth bootstrap) reflects the freshly-created
    // session — exactly like a real cookie-backed login would.
    const mocks = await installApiMocks(page, {
      user: null,
      credentials: { email: EMAIL, password: PASSWORD },
    });
    await page.route(/\/api\/auth\/login$/, async (route) => {
      const body = route.request().postDataJSON() as { email: string; password: string };
      if (body.email === EMAIL && body.password === PASSWORD) {
        mocks.state.user = user;
      }
      await route.fallback();
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText(new RegExp(user.username, "i"))).toBeVisible();
  });

  test("shows an error and stays on the page for a wrong password", async ({ page }) => {
    await installApiMocks(page, {
      user: null,
      credentials: { email: EMAIL, password: PASSWORD },
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
