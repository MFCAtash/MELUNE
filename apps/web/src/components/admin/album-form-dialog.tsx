"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@codex-music/api-client";
import type { Album } from "@codex-music/types";
import { Field, Modal, inputClass } from "@/components/admin/modal";
import { PresignedUploadField } from "@/components/admin/presigned-upload-field";
import { useAdminArtists, useAdminCreateAlbum, useAdminUpdateAlbum } from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";

export function AlbumFormDialog({
  open,
  onClose,
  album,
}: {
  open: boolean;
  onClose: () => void;
  album?: Album;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  const { data: artists } = useAdminArtists();
  const create = useAdminCreateAlbum();
  const update = useAdminUpdateAlbum();

  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(album?.title ?? "");
    setArtistId(album?.artist.id ?? "");
    setCoverUrl(album?.coverUrl ?? "");
    setReleaseDate(album?.releaseDate ? album.releaseDate.slice(0, 10) : "");
    setError(null);
    titleRef.current?.focus();
  }, [open, album]);

  if (!open) return null;

  const isEdit = Boolean(album);
  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("admin.albums.validationTitleRequired"));
      return;
    }
    if (!isEdit && !artistId) {
      setError(t("admin.albums.validationArtistRequired"));
      return;
    }

    const payload = {
      title: title.trim(),
      coverUrl: coverUrl.trim() || undefined,
      releaseDate: releaseDate || undefined,
      ...(isEdit ? {} : { artistId }),
    };

    setError(null);
    try {
      if (album) {
        await update.mutateAsync({ id: album.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.albums.saveError"));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("admin.albums.dialogEditTitle") : t("admin.albums.dialogCreateTitle")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("admin.albums.fieldTitle")}>
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        {!isEdit && (
          <Field label={t("admin.albums.fieldArtist")}>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={inputClass}>
              <option value="">{t("admin.albums.fieldArtistPlaceholder")}</option>
              {artists?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t("admin.albums.fieldCoverUrl")}>
          <PresignedUploadField kind="cover" accept="image/*" value={coverUrl} onChange={setCoverUrl} />
        </Field>

        <Field label={t("admin.albums.fieldReleaseDate")}>
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:border-primary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-codex-gradient rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? t("admin.albums.saving") : isEdit ? t("admin.albums.saveChanges") : t("admin.albums.createAlbum")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
