import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";

// The full-screen player nests LikeButton and AddToPlaylistButton, both of
// which call React Query hooks that go through `apiClient` — mock the
// client itself rather than every hook, so the real query/mutation logic
// still runs against known, instant responses.
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    listMyLikes: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 100, total: 0, totalPages: 1 }),
    likeSong: vi.fn().mockResolvedValue(undefined),
    unlikeSong: vi.fn().mockResolvedValue(undefined),
    listMyPlaylists: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }),
    addSongToPlaylist: vi.fn().mockResolvedValue(undefined),
  },
}));

import { FullScreenPlayer } from "../full-screen-player";

const TRACK: Song = {
  id: "song-1",
  title: "Midnight Drive",
  slug: "midnight-drive",
  duration: 200,
  audioUrl: "https://example.com/midnight-drive.mp3",
  coverUrl: null, // keeps next/image out of the tree entirely (see docs/frontend note below)
  playCount: 42,
  artist: { id: "artist-1", name: "Nova Ray", slug: "nova-ray", imageUrl: null },
  album: null,
  genre: null,
};

function renderPlayer(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <FullScreenPlayer onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

beforeEach(() => {
  usePlayerStore.setState({
    queue: [TRACK],
    originalQueue: [TRACK],
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 200,
    shuffle: false,
    repeat: "off",
  });
  useUiStore.setState({ queueOpen: false, fullScreenOpen: true });
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "listener@example.com",
      username: "listener",
      role: "USER",
      avatarUrl: null,
      bio: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ready: true,
  });
});

describe("FullScreenPlayer", () => {
  it("renders the current track and reflects the paused state", () => {
    renderPlayer();

    expect(screen.getByRole("dialog", { name: "Now playing" })).toBeInTheDocument();
    expect(screen.getByText("Midnight Drive")).toBeInTheDocument();
    expect(screen.getByText("Nova Ray")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("toggles play/pause through the real player store when clicked", async () => {
    const user = userEvent.setup();
    renderPlayer();

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(await screen.findByRole("button", { name: "Pause" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("seeking moves playback to the chosen time via the seek bar", () => {
    renderPlayer();

    const seekBar = screen.getByLabelText("Seek");
    fireEvent.change(seekBar, { target: { value: "120" } });

    expect(usePlayerStore.getState().currentTime).toBe(120);
  });

  it("calls onClose when the minimize button is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPlayer();

    await user.click(screen.getByRole("button", { name: "Minimize player" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to the lyrics tab and shows the fetched lines", async () => {
    const user = userEvent.setup();
    renderPlayer();

    await user.click(screen.getByRole("button", { name: "Lyrics" }));

    expect(await screen.findByText(/Lyrics aren't available for this track yet/)).toBeInTheDocument();
  });

  // Phase 10.2 — Player Polish: the active line auto-scrolls into view
  // instead of leaving the reader to find it manually. jsdom doesn't
  // implement scrollIntoView, so the real assertion here is "the active
  // line's own element is the one asked to scroll", not the resulting
  // scroll position.
  it("auto-scrolls the active lyric line into view as playback advances", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPlayer();

    await user.click(screen.getByRole("button", { name: "Lyrics" }));
    await screen.findByText(/Lyrics aren't available for this track yet/);
    scrollIntoView.mockClear();

    usePlayerStore.setState({ currentTime: 16 });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    const activeLine = screen.getByText("This view is wired up and ready");
    expect(scrollIntoView.mock.instances[scrollIntoView.mock.instances.length - 1]).toBe(activeLine);
  });

  it("toggles shuffle and reflects the pressed state from the store", async () => {
    const user = userEvent.setup();
    renderPlayer();

    const shuffleButton = screen.getByRole("button", { name: "Shuffle off" });
    expect(shuffleButton).toHaveAttribute("aria-pressed", "false");

    await user.click(shuffleButton);

    expect(usePlayerStore.getState().shuffle).toBe(true);
    expect(await screen.findByRole("button", { name: "Shuffle on" })).toHaveAttribute("aria-pressed", "true");
  });
});
