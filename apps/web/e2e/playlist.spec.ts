import { test, expect, type Page } from "@playwright/test";
import { installApiMocks, makePlaylist, makeSong, makeUser } from "./utils/mock-api";

/**
 * "Add to playlist" only exists inside the full-screen player (see
 * src/components/library/add-to-playlist-button.tsx, only ever rendered
 * from full-screen-player.tsx) — and the only way to reach that overlay
 * is the mobile mini-player's "Now playing" button (persistent-player.tsx
 * never wires `openFullScreen` on desktop). So these specs run at a
 * phone-sized viewport, matching the real path a user has to take.
 */
test.use({ viewport: { width: 414, height: 896 } });

async function login(page: Page, opts: Parameters<typeof installApiMocks>[1] = {}) {
  const user = makeUser();
  return { user, mocks: await installApiMocks(page, { user, ...opts }) };
}

test.describe("playlists", () => {
  test("creates a new playlist from the library page", async ({ page }) => {
    await login(page);

    await page.goto("/library");
    await page.getByRole("button", { name: "New playlist" }).click();

    const dialog = page.getByRole("dialog", { name: "New playlist" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Name").fill("Road Trip Anthems");
    await dialog.getByRole("button", { name: "Create playlist" }).click();

    await expect(page).toHaveURL(/\/playlist\//);
    await expect(page.getByRole("heading", { name: "Road Trip Anthems" })).toBeVisible();
  });

  test("adds the currently playing song to a playlist from the full-screen player", async ({ page }) => {
    const song = makeSong({ title: "Golden Hour" });
    const { user, mocks } = await login(page, {
      home: { recentlyPlayed: [song], trending: [], madeForYou: [] },
      songs: [song],
    });
    const playlist = makePlaylist({
      title: "Chill Vibes",
      owner: { id: user.id, username: user.username },
    });
    mocks.seedPlaylist(playlist);

    await page.goto("/home");
    await page.getByRole("button", { name: `Play ${song.title}` }).first().click();

    // Opens the full-screen player (mobile mini-player -> "Now playing").
    await page.getByRole("button", { name: new RegExp(`^Now playing: ${song.title}$`) }).click();
    const dialog = page.getByRole("dialog", { name: "Now playing" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Add to playlist" }).click();
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(`/playlists/${playlist.id}/songs`) && res.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: playlist.title }).click(),
    ]);
    await expect(page.getByText("Couldn't add this song", { exact: false })).toHaveCount(0);

    // Confirm it actually landed in the playlist, not just that the
    // button didn't show an error.
    await page.goto(`/playlist/${playlist.slug}`);
    await expect(page.getByText(song.title)).toBeVisible();
    await expect(page.getByText("1 song", { exact: false })).toBeVisible();
  });

  test("reorders songs in a playlist by dragging", async ({ page }) => {
    const first = makeSong({ title: "Song Alpha" });
    const second = makeSong({ title: "Song Beta" });
    const { user, mocks } = await login(page);
    const playlist = makePlaylist({
      title: "Drag Test Mix",
      owner: { id: user.id, username: user.username },
      items: [
        { id: "entry-1", position: 0, addedAt: new Date().toISOString(), song: first },
        { id: "entry-2", position: 1, addedAt: new Date().toISOString(), song: second },
      ],
    });
    mocks.seedPlaylist(playlist);

    await page.goto(`/playlist/${playlist.slug}`);
    const rows = page.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(first.title);
    await expect(rows.nth(1)).toContainText(second.title);

    const source = rows.filter({ hasText: first.title });
    const target = rows.filter({ hasText: second.title });
    const sourceBox = (await source.boundingBox())!;
    const targetBox = (await target.boundingBox())!;

    // Native HTML5 drag-and-drop (see track-list.tsx) needs real,
    // stepped mouse movement to register — a single dragTo() jump
    // doesn't reliably fire dragstart/dragover/drop in Chromium.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 4, { steps: 10 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect(rows.nth(0)).toContainText(second.title);
    await expect(rows.nth(1)).toContainText(first.title);
  });
});
