"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Song } from "@codex-music/types";
import { ApiError } from "@codex-music/api-client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { SongFormDialog } from "@/components/admin/song-form-dialog";
import { useAdminDeleteSong, useAdminGenres, useAdminSongs } from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";

export default function AdminSongsPage() {
  const [page, setPage] = useState(1);
  const [genreId, setGenreId] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; song?: Song }>({ open: false });
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const { t } = useTranslation();

  const { data, isLoading } = useAdminSongs({ page, limit: 20, genreId: genreId || undefined });
  const { data: genres } = useAdminGenres();
  const del = useAdminDeleteSong();

  async function handleDelete(song: Song) {
    if (!confirm(t("admin.songs.confirmDelete", { title: song.title }))) return;
    setMessage(null);
    try {
      await del.mutateAsync(song.id);
      setMessage({ kind: "success", text: t("admin.songs.deleteSuccess") });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : t("admin.songs.deleteError"),
      });
    }
  }

  const columns = useMemo<ColumnDef<Song, any>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("admin.songs.columnTitle"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.original.coverUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-surfaceElevated" />
            )}
            <span className="font-medium text-foreground">{row.original.title}</span>
          </div>
        ),
      },
      { id: "artist", header: t("admin.songs.columnArtist"), cell: ({ row }) => row.original.artist.name },
      {
        id: "genre",
        header: t("admin.songs.columnGenre"),
        cell: ({ row }) => row.original.genre?.name ?? "—",
      },
      {
        accessorKey: "playCount",
        header: t("admin.songs.columnPlays"),
        cell: ({ row }) => row.original.playCount.toLocaleString("fa-IR"),
      },
      {
        id: "features",
        header: t("admin.songs.columnFeatures"),
        cell: ({ row }) => {
          const s = row.original;
          return s.bpm || s.mood ? `${s.bpm ?? "—"} · ${s.mood ?? "—"}` : "—";
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDialog({ open: true, song: row.original })}
              aria-label={t("admin.songs.editAria")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surfaceElevated hover:text-foreground"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              aria-label={t("admin.songs.deleteAria")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("admin.songs.title")}</h1>
        <button
          type="button"
          onClick={() => setDialog({ open: true })}
          className="bg-codex-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={15} />
          {t("admin.songs.newSong")}
        </button>
      </div>

      <select
        value={genreId}
        onChange={(e) => {
          setGenreId(e.target.value);
          setPage(1);
        }}
        className="rounded-xl border border-border bg-surfaceElevated px-3 py-2 text-sm"
      >
        <option value="">{t("admin.songs.allGenres")}</option>
        {genres?.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {message && (
        <p
          role="status"
          className={`rounded-xl px-3.5 py-2 text-sm ${
            message.kind === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        emptyMessage={t("admin.songs.emptyMessage")}
        pagination={
          data ? { page: data.page, totalPages: data.totalPages, onPageChange: setPage } : undefined
        }
      />

      <SongFormDialog open={dialog.open} song={dialog.song} onClose={() => setDialog({ open: false })} />
    </div>
  );
}
