"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@codex-music/api-client";
import type { UploadKind } from "@codex-music/types";
import { apiClient } from "@/lib/api-client";

export type PresignedUploadStatus = "idle" | "presigning" | "uploading" | "success" | "error";

export interface PresignedUploadState {
  status: PresignedUploadStatus;
  /** 0-100. Only meaningful while `status === "uploading"` (the presign
   *  request itself has no useful progress signal to report). */
  progress: number;
  error: string | null;
}

/**
 * Direct-to-bucket upload flow, shared by every "upload a file, get back
 * a URL" form field (Phase 12: admin songs/albums, and any future
 * artist-facing upload form — see `PresignedUploadField`, which is the
 * component built on top of this hook).
 *
 * Two-step flow, matching `apps/api/src/storage`:
 * 1. Ask the API for a presigned PUT url for this `kind` (`POST
 *    /uploads/presign`) — this is also where role/content-type/size
 *    are validated server-side.
 * 2. PUT the file straight to that url (never through the API process —
 *    a Node server proxying a 100MB audio file would be a poor use of
 *    it). Uses XHR rather than `fetch` only because XHR is the only one
 *    of the two that exposes upload progress events.
 *
 * Returns the object's permanent `publicUrl` on success — the caller is
 * responsible for putting that into the `audioUrl`/`coverUrl`/`avatarUrl`
 * field it belongs to; this hook never talks to `/songs`, `/albums`, etc.
 */
export function usePresignedUpload(kind: UploadKind) {
  const [state, setState] = useState<PresignedUploadState>({
    status: "idle",
    progress: 0,
    error: null,
  });
  // So a slow upload that finishes after the caller has already started
  // a second one (or unmounted) can't clobber newer state.
  const requestId = useRef(0);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState({ status: "idle", progress: 0, error: null });
  }, []);

  const upload = useCallback(
    (file: File): Promise<string> => {
      const id = ++requestId.current;
      setState({ status: "presigning", progress: 0, error: null });

      return apiClient
        .presignUpload({
          kind,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })
        .then(
          ({ uploadUrl, publicUrl }) =>
            new Promise<string>((resolve, reject) => {
              if (requestId.current !== id) return; // superseded

              setState({ status: "uploading", progress: 0, error: null });

              const xhr = new XMLHttpRequest();
              xhr.open("PUT", uploadUrl);
              xhr.setRequestHeader("Content-Type", file.type);

              xhr.upload.onprogress = (event) => {
                if (requestId.current !== id || !event.lengthComputable) return;
                setState((prev) => ({
                  ...prev,
                  progress: Math.round((event.loaded / event.total) * 100),
                }));
              };

              xhr.onload = () => {
                if (requestId.current !== id) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                  setState({ status: "success", progress: 100, error: null });
                  resolve(publicUrl);
                } else {
                  const message = `Upload failed (${xhr.status})`;
                  setState({ status: "error", progress: 0, error: message });
                  reject(new Error(message));
                }
              };

              xhr.onerror = () => {
                if (requestId.current !== id) return;
                const message = "Network error during upload";
                setState({ status: "error", progress: 0, error: message });
                reject(new Error(message));
              };

              xhr.send(file);
            }),
        )
        .catch((err) => {
          if (requestId.current === id) {
            const message = err instanceof ApiError ? err.message : "Could not start the upload";
            setState({ status: "error", progress: 0, error: message });
          }
          throw err;
        });
    },
    [kind],
  );

  return { ...state, upload, reset };
}
