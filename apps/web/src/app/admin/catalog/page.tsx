"use client";

import { useState } from "react";
import { ApiError } from "@melune/api-client";
import type { Artist, Genre } from "@melune/types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, Modal, inputClass } from "@/components/admin/modal";
import {
  useAdminArtists,
  useAdminCreateArtist,
  useAdminCreateGenre,
  useAdminDeleteArtist,
  useAdminDeleteGenre,
  useAdminGenres,
  useAdminUpdateArtist,
  useAdminUpdateGenre,
} from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";

export default function AdminCatalogPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.catalog.title")}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ArtistsPanel />
        <GenresPanel />
      </div>
    </div>
  );
}

function ArtistsPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminArtists();
  const create = useAdminCreateArtist();
  const update = useAdminUpdateArtist();
  const del = useAdminDeleteArtist();
  const [dialog, setDialog] = useState<{ open: boolean; artist?: Artist }>({ open: false });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openDialog(artist?: Artist) {
    setName(artist?.name ?? "");
    setError(null);
    setDialog({ open: true, artist });
  }

  async function handleDelete(artist: Artist) {
    if (!confirm(t("admin.catalog.confirmDeleteArtist", { name: artist.name }))) return;
    setError(null);
    try {
      await del.mutateAsync(artist.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.catalog.deleteArtistError"));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("admin.catalog.artistNameRequired"));
      return;
    }
    setError(null);
    try {
      if (dialog.artist) {
        await update.mutateAsync({ id: dialog.artist.id, payload: { name: name.trim() } });
      } else {
        await create.mutateAsync({ name: name.trim() });
      }
      setDialog({ open: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.catalog.saveArtistError"));
    }
  }

  return (
    <GlassPanel className="p-4">
      <PanelHeader
        title={t("admin.catalog.artistsTitle")}
        action={
          <button
            type="button"
            onClick={() => openDialog()}
            aria-label={t("admin.catalog.newArtistAria")}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-melune-gradient text-white"
          >
            <Plus size={15} />
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data?.items.map((artist) => (
            <li key={artist.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span className="truncate">{artist.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openDialog(artist)}
                  aria-label={t("admin.catalog.editAria")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surfaceElevated hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(artist)}
                  aria-label={t("admin.catalog.deleteAria")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
          {data?.items.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">{t("admin.catalog.emptyArtists")}</li>
          )}
        </ul>
      )}

      <Modal
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        title={dialog.artist ? t("admin.catalog.editArtistTitle") : t("admin.catalog.newArtistTitle")}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("admin.catalog.nameField")}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDialog({ open: false })}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="bg-melune-gradient rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </GlassPanel>
  );
}

function GenresPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminGenres();
  const create = useAdminCreateGenre();
  const update = useAdminUpdateGenre();
  const del = useAdminDeleteGenre();
  const [dialog, setDialog] = useState<{ open: boolean; genre?: Genre }>({ open: false });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openDialog(genre?: Genre) {
    setName(genre?.name ?? "");
    setError(null);
    setDialog({ open: true, genre });
  }

  async function handleDelete(genre: Genre) {
    if (!confirm(t("admin.catalog.confirmDeleteGenre", { name: genre.name }))) return;
    setError(null);
    try {
      await del.mutateAsync(genre.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.catalog.deleteGenreError"));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("admin.catalog.genreNameRequired"));
      return;
    }
    setError(null);
    try {
      if (dialog.genre) {
        await update.mutateAsync({ id: dialog.genre.id, payload: { name: name.trim() } });
      } else {
        await create.mutateAsync({ name: name.trim() });
      }
      setDialog({ open: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.catalog.saveGenreError"));
    }
  }

  return (
    <GlassPanel className="p-4">
      <PanelHeader
        title={t("admin.catalog.genresTitle")}
        action={
          <button
            type="button"
            onClick={() => openDialog()}
            aria-label={t("admin.catalog.newGenreAria")}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-melune-gradient text-white"
          >
            <Plus size={15} />
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data?.map((genre) => (
            <li key={genre.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span className="truncate">{genre.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openDialog(genre)}
                  aria-label={t("admin.catalog.editAria")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surfaceElevated hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(genre)}
                  aria-label={t("admin.catalog.deleteAria")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
          {data?.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">{t("admin.catalog.emptyGenres")}</li>
          )}
        </ul>
      )}

      <Modal
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        title={dialog.genre ? t("admin.catalog.editGenreTitle") : t("admin.catalog.newGenreTitle")}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("admin.catalog.nameField")}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDialog({ open: false })}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="bg-melune-gradient rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </GlassPanel>
  );
}
