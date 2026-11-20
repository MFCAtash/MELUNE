"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Album } from "@melune/types";
import { ApiError } from "@melune/api-client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { AlbumFormDialog } from "@/components/admin/album-form-dialog";
import { useAdminAlbums, useAdminDeleteAlbum } from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";

export default function AdminAlbumsPage() {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; album?: Album }>({ open: false });
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const { t } = useTranslation();

  const { data, isLoading } = useAdminAlbums({ page, limit: 20 });
  const del = useAdminDeleteAlbum();

  async function handleDelete(album: Album) {
    if (!confirm(t("admin.albums.confirmDelete", { title: album.title }))) return;
    setMessage(null);
    try {
      await del.mutateAsync(album.id);
      setMessage({ kind: "success", text: t("admin.albums.deleteSuccess") });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof ApiError ? err.message : t("admin.albums.deleteError"),
      });
    }
  }

  const columns = useMemo<ColumnDef<Album, any>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("admin.albums.columnTitle"),
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
      { id: "artist", header: t("admin.albums.columnArtist"), cell: ({ row }) => row.original.artist.name },
      {
        id: "tracks",
        header: t("admin.albums.columnTracks"),
        cell: ({ row }) => row.original.songs?.length ?? 0,
      },
      {
        accessorKey: "releaseDate",
        header: t("admin.albums.columnReleaseDate"),
        cell: ({ row }) =>
          row.original.releaseDate ? new Date(row.original.releaseDate).toLocaleDateString("fa-IR") : "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDialog({ open: true, album: row.original })}
              aria-label={t("admin.albums.editAria")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surfaceElevated hover:text-foreground"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.original)}
              aria-label={t("admin.albums.deleteAria")}
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
        <h1 className="text-2xl font-bold">{t("admin.albums.title")}</h1>
        <button
          type="button"
          onClick={() => setDialog({ open: true })}
          className="bg-melune-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={15} />
          {t("admin.albums.newAlbum")}
        </button>
      </div>

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
        getRowId={(a) => a.id}
        isLoading={isLoading}
        emptyMessage={t("admin.albums.emptyMessage")}
        pagination={
          data ? { page: data.page, totalPages: data.totalPages, onPageChange: setPage } : undefined
        }
      />

      <AlbumFormDialog open={dialog.open} album={dialog.album} onClose={() => setDialog({ open: false })} />
    </div>
  );
}
