"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@melune/api-client";
import type { Song } from "@melune/types";
import { Field, Modal, inputClass } from "@/components/admin/modal";
import { PresignedUploadField } from "@/components/admin/presigned-upload-field";
import { useAdminArtists, useAdminCreateSong, useAdminGenres, useAdminUpdateSong } from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";

export function SongFormDialog({
  open,
  onClose,
  song,
}: {
  open: boolean;
  onClose: () => void;
  song?: Song;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  const { data: artists } = useAdminArtists();
  const { data: genres } = useAdminGenres();
  const create = useAdminCreateSong();
  const update = useAdminUpdateSong();

  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [genreId, setGenreId] = useState("");
  const [duration, setDuration] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bpm, setBpm] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(song?.title ?? "");
    setArtistId(song?.artist.id ?? "");
    setGenreId(song?.genre?.id ?? "");
    setDuration(song ? String(song.duration) : "");
    setAudioUrl(song?.audioUrl ?? "");
    setCoverUrl(song?.coverUrl ?? "");
    setBpm(song?.bpm != null ? String(song.bpm) : "");
    setMood(song?.mood ?? "");
    setEnergy(song?.energy != null ? String(song.energy) : "");
    setError(null);
    titleRef.current?.focus();
  }, [open, song]);

  if (!open) return null;

  const isEdit = Boolean(song);
  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !audioUrl.trim() || !duration) {
      setError(t("admin.songs.validationRequired"));
      return;
    }
    if (!isEdit && !artistId) {
      setError(t("admin.songs.validationArtistRequired"));
      return;
    }

    const payload = {
      title: title.trim(),
      genreId: genreId || undefined,
      duration: Number(duration),
      audioUrl: audioUrl.trim(),
      coverUrl: coverUrl.trim() || undefined,
      bpm: bpm ? Number(bpm) : undefined,
      mood: mood.trim() || undefined,
      energy: energy ? Number(energy) : undefined,
      ...(isEdit ? {} : { artistId }),
    };

    setError(null);
    try {
      if (song) {
        await update.mutateAsync({ id: song.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.songs.saveError"));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("admin.songs.dialogEditTitle") : t("admin.songs.dialogCreateTitle")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("admin.songs.fieldTitle")}>
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        {!isEdit && (
          <Field label={t("admin.songs.fieldArtist")}>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={inputClass}>
              <option value="">{t("admin.songs.fieldArtistPlaceholder")}</option>
              {artists?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("admin.songs.fieldGenre")}>
            <select value={genreId} onChange={(e) => setGenreId(e.target.value)} className={inputClass}>
              <option value="">{t("admin.songs.fieldNoGenre")}</option>
              {genres?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("admin.songs.fieldDuration")}>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("admin.songs.fieldAudioUrl")}>
          <PresignedUploadField kind="audio" accept="audio/*" value={audioUrl} onChange={setAudioUrl} />
        </Field>

        <Field label={t("admin.songs.fieldCoverUrl")}>
          <PresignedUploadField kind="cover" accept="image/*" value={coverUrl} onChange={setCoverUrl} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t("admin.songs.fieldBpm")}>
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className={inputClass}
              placeholder={t("admin.songs.fieldOptional")}
            />
          </Field>
          <Field label={t("admin.songs.fieldMood")}>
            <input
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className={inputClass}
              placeholder={t("admin.songs.fieldMoodPlaceholder")}
            />
          </Field>
          <Field label={t("admin.songs.fieldEnergy")}>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={energy}
              onChange={(e) => setEnergy(e.target.value)}
              className={inputClass}
              placeholder={t("admin.songs.fieldOptional")}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">{t("admin.songs.featuresHint")}</p>

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
            className="bg-melune-gradient rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? t("admin.songs.saving") : isEdit ? t("admin.songs.saveChanges") : t("admin.songs.createSong")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
