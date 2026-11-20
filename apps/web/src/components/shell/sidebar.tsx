"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { FolderOpen, Plus, ShieldCheck } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { coverPalette } from "@/lib/cover";
import { filesToTracks } from "@/lib/local-audio";
import { flatItems, useMyPlaylists } from "@/lib/queries";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";
import { NAV_ICONS } from "./nav-icons";
import { Logo } from "./logo";

export function Sidebar({ onCreatePlaylist }: { onCreatePlaylist: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const hasTrack = usePlayerStore((s) => s.queue.length > 0 && s.currentIndex >= 0);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playlistsQuery = useMyPlaylists();
  const playlists = flatItems(playlistsQuery.data);
  const { t } = useTranslation();
  const localInputRef = useRef<HTMLInputElement>(null);

  /** Import full-length audio files from this device and start playing them. */
  const importLocalFiles = async (fileList: FileList | null) => {
    const files = [...(fileList ?? [])];
    // Reset so picking the same file again re-triggers onChange.
    if (localInputRef.current) localInputRef.current.value = "";
    if (files.length === 0) return;
    const tracks = await filesToTracks(files);
    if (tracks.length > 0) playQueue(tracks, 0);
  };

  return (
    <aside
      aria-label="Sidebar"
      className={`fixed inset-y-0 start-0 z-20 hidden w-60 flex-col border-e border-border bg-surface md:flex ${
        hasTrack ? "pb-24" : "pb-4"
      }`}
    >
      <Logo className="mx-6 mb-6 mt-7 text-2xl font-bold tracking-wide" />

      <nav aria-label="Primary" className="px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const active = isActive(pathname, item.href);
            const label = t(item.labelKey);
            const base = "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm";
            return (
              <li key={item.id}>
                {item.soon ? (
                  <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted/50`}>
                    <Icon size={18} />
                    {label}
                    <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-[10px]">
                      {t("nav.soon")}
                    </span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`${base} transition-colors ${
                      active
                        ? "bg-surfaceElevated font-medium text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <Icon size={18} className={active ? "text-primary" : ""} />
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-6 my-5 border-t border-border" />

      {/* Local audio import — full-length files straight from the user's device */}
      <input
        ref={localInputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.oga,.aac,.opus,.wma,.aif,.aiff,.alac"
        multiple
        hidden
        onChange={(e) => void importLocalFiles(e.target.files)}
      />
      <button
        onClick={() => localInputRef.current?.click()}
        title={t("local.hint")}
        className="mx-3 mb-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:border-primary hover:text-foreground"
      >
        <FolderOpen size={18} />
        {t("local.import")}
      </button>

      {user?.role === "ADMIN" && (
        <Link
          href="/admin"
          className="mx-3 mb-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:border-primary hover:text-foreground"
        >
          <ShieldCheck size={18} />
          پنل مدیریت
        </Link>
      )}

      {user ? (
        <section aria-label="Your playlists" className="flex min-h-0 flex-1 flex-col px-3">
          <div className="mb-2 flex items-center justify-between px-3">
            <h2 className="text-sm font-medium text-muted">Playlists</h2>
            <button
              onClick={onCreatePlaylist}
              aria-label="New playlist"
              title="New playlist"
              className="rounded-md p-1 text-muted transition-colors hover:bg-surfaceElevated hover:text-foreground"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {playlistsQuery.isLoading && (
              <div className="space-y-3 px-3 py-1" role="status" aria-label="Loading playlists">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            )}

            {playlistsQuery.isError && (
              <p className="px-3 text-xs text-muted">Couldn&apos;t load your playlists.</p>
            )}

            {playlistsQuery.isSuccess && playlists.length === 0 && (
              <p className="px-3 text-xs leading-relaxed text-muted">
                Nothing here yet.{" "}
                <button onClick={onCreatePlaylist} className="text-primary hover:underline">
                  Create your first playlist
                </button>
              </p>
            )}

            <ul className="space-y-0.5">
              {playlists.map((p) => {
                const href = `/playlist/${p.slug}`;
                const active = pathname === href;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-surfaceElevated text-foreground" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: p.accentColor ?? coverPalette(p.id)[0] }}
                      />
                      <span className="truncate">{p.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {playlistsQuery.hasNextPage && (
              <Link
                href="/library"
                className="mt-1 block px-3 py-2 text-xs text-muted hover:text-primary"
              >
                See all playlists
              </Link>
            )}
          </div>
        </section>
      ) : (
        ready && (
          <div className="mx-3 rounded-xl border border-border bg-surfaceElevated p-4">
            <p className="text-sm font-medium text-foreground">Keep what you love</p>
            <p className="mt-1 text-xs text-muted">
              Sign in to like songs, build playlists and get mixes made for you.
            </p>
            <Link
              href="/login"
              className="bg-codex-gradient mt-3 block rounded-lg py-2 text-center text-sm font-medium text-white"
            >
              {t("nav.logIn")}
            </Link>
          </div>
        )
      )}
    </aside>
  );
}
