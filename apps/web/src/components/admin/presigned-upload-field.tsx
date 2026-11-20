"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import type { UploadKind } from "@codex-music/types";
import { usePresignedUpload } from "@/hooks/use-presigned-upload";
import { useTranslation } from "@/hooks/use-translation";
import { inputClass } from "@/components/admin/modal";

/**
 * Direct-to-bucket file field for admin song/album forms (Phase 12) —
 * replaces the plain `<input type="text">` that used to take a raw
 * audioUrl/coverUrl. Not admin-specific by construction: it's built on
 * `usePresignedUpload`, the same hook any future artist-facing upload
 * form should import (not copy) once one exists — there was no such
 * form/component anywhere in the codebase to reuse when this was built,
 * so this is now that shared component.
 *
 * A manual URL field stays available (collapsed by default) since
 * existing rows can already point at URLs this UI never uploaded —
 * an admin fixing up imported data still needs to be able to paste one.
 */
export function PresignedUploadField({
  kind,
  value,
  onChange,
  accept,
  disabled,
}: {
  kind: UploadKind;
  value: string;
  onChange: (url: string) => void;
  accept: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { status, progress, error, upload, reset } = usePresignedUpload(kind);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = status === "presigning" || status === "uploading";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const publicUrl = await upload(file);
      onChange(publicUrl);
    } catch {
      // Surfaced via `error` below — nothing else to do here.
    }
  }

  function handleClear() {
    reset();
    onChange("");
  }

  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        disabled={disabled || busy}
        onChange={handleFileChange}
        className="hidden"
      />

      {kind === "cover" && value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover" />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm hover:border-primary disabled:opacity-60"
        >
          <Upload size={14} />
          {value ? t("admin.upload.replaceFile") : t("admin.upload.chooseFile")}
        </button>

        {value && !busy && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{fileName}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              aria-label={t("admin.upload.remove")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400"
            >
              <X size={13} />
            </button>
          </>
        )}
      </div>

      {busy && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surfaceElevated">
            <div
              className="h-full bg-codex-gradient transition-all"
              style={{ width: `${status === "uploading" ? progress : 8}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {status === "presigning" ? t("admin.upload.preparing") : t("admin.upload.uploading", { progress })}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {t("admin.upload.uploadFailed")}: {error}
        </p>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-foreground">
          {t("admin.upload.orPasteUrl")}
        </summary>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || busy}
          placeholder={t("admin.upload.urlPlaceholder")}
          className={`${inputClass} mt-2`}
        />
      </details>
    </div>
  );
}
