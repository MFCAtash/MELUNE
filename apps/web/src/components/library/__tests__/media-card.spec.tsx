import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaCard } from "../media-card";
import { usePlayerStore } from "@/store/player-store";

describe("MediaCard", () => {
  it("links to the given href and shows the title and subtitle", () => {
    render(
      <MediaCard href="/playlist/chill-vibes" title="Chill Vibes" subtitle="By listener" coverUrl={null} />,
    );

    const link = screen.getByRole("link", { name: /Chill Vibes/ });
    expect(link).toHaveAttribute("href", "/playlist/chill-vibes");
    expect(screen.getByText("Chill Vibes")).toBeInTheDocument();
    expect(screen.getByText("By listener")).toBeInTheDocument();
  });

  it("omits the subtitle paragraph entirely when none is given", () => {
    const { container } = render(<MediaCard href="/album/some-album" title="Some Album" coverUrl={null} />);

    // Only one <p> (the title) should be present — no empty subtitle node.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders a rounded, centered tile for artists (round=true)", () => {
    render(<MediaCard href="/artist/nova-ray" title="Nova Ray" subtitle="Artist" coverUrl={null} round />);

    const title = screen.getByText("Nova Ray");
    expect(title.className).toContain("text-center");
    expect(screen.getByText("Artist").className).toContain("text-center");
  });

  it("defaults to a square, left-aligned tile when round is not set", () => {
    render(<MediaCard href="/album/some-album" title="Some Album" subtitle="Nova Ray" coverUrl={null} />);

    const title = screen.getByText("Some Album");
    expect(title.className).not.toContain("text-center");
  });

  describe("Tempo-Reactive UI (now-playing border pulse)", () => {
    afterEach(() => {
      usePlayerStore.setState({ queue: [], currentIndex: -1, isPlaying: false });
    });

    it("renders without throwing when this card's album is the one currently playing", () => {
      usePlayerStore.setState({
        queue: [
          {
            id: "song-1",
            title: "Track",
            coverUrl: null,
            artist: { id: "a1", name: "Nova Ray", slug: "nova-ray", imageUrl: null },
            album: { id: "al1", title: "Some Album", slug: "some-album", coverUrl: null },
          } as never,
        ],
        currentIndex: 0,
        isPlaying: true,
      });

      expect(() =>
        render(<MediaCard href="/album/some-album" title="Some Album" coverUrl={null} />),
      ).not.toThrow();
    });

    it("renders without throwing when nothing playing matches this card", () => {
      usePlayerStore.setState({ queue: [], currentIndex: -1, isPlaying: false });
      expect(() =>
        render(<MediaCard href="/album/some-album" title="Some Album" coverUrl={null} />),
      ).not.toThrow();
    });
  });
});
