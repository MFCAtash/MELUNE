import { test, expect } from "@playwright/test";
import { installApiMocks, makeSong, makeUser } from "./utils/mock-api";

const SONG_TITLE = "Midnight Drive";

async function loginAndGoHome(page: import("@playwright/test").Page) {
  const user = makeUser();
  const song = makeSong({ title: SONG_TITLE, duration: 200 });
  await installApiMocks(page, {
    user,
    // Only "recently played" is populated: with nothing trending and no
    // "made for you" mix, the hero banner and shelf don't render at all,
    // so the song title only ever appears once — in the "Continue
    // listening" row, and (once played) in the persistent player bar.
    home: { recentlyPlayed: [song], trending: [], madeForYou: [] },
  });
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: new RegExp(`^good|still up`, "i") })).toBeVisible();
  return { user, song };
}

test.describe("player", () => {
  test("plays a song from the recently-played list", async ({ page }) => {
    await loginAndGoHome(page);

    await page.getByRole("button", { name: `Play ${SONG_TITLE}` }).click();

    // The persistent player bar only mounts once a track is queued, and
    // is the only place the title renders as a link (rather than inside
    // a row's play/pause button), so this uniquely targets it.
    await expect(page.getByRole("link", { name: SONG_TITLE, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("pauses and resumes from the mini-player", async ({ page }) => {
    await loginAndGoHome(page);
    await page.getByRole("button", { name: `Play ${SONG_TITLE}` }).click();

    const toggle = page.getByRole("button", { name: "Pause" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("moves the seek bar", async ({ page }) => {
    await loginAndGoHome(page);
    await page.getByRole("button", { name: `Play ${SONG_TITLE}` }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    const seekBar = page.getByLabel("Seek");
    await expect(seekBar).toHaveValue("0");

    await seekBar.focus();
    await seekBar.press("End"); // native range-input behaviour: jump to max
    await expect(seekBar).toHaveValue("200");

    await seekBar.press("Home"); // jump back to the start
    await expect(seekBar).toHaveValue("0");
  });
});
