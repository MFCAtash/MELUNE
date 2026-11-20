"use client";

import { useCallback, useEffect, useState } from "react";
import type { DownloadableTrack } from "@/lib/offline-store";
import {
  deleteTrackOffline,
  downloadTrackOffline,
  isTrackDownloaded,
  offlineDownloadsSupported,
  subscribeOfflineChanges,
} from "@/lib/offline-store";

export function useOfflineTrack(track: DownloadableTrack | null | undefined) {
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!track) return;
    setDownloaded(await isTrackDownloaded(track.id));
  }, [track]);

  useEffect(() => {
    void refresh();
    return subscribeOfflineChanges(() => void refresh());
  }, [refresh]);

  const download = useCallback(async () => {
    if (!track || downloading) return;
    setError(false);
    setDownloading(true);
    setProgress(0);
    try {
      await downloadTrackOffline(track, setProgress);
      setDownloaded(true);
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  }, [track, downloading]);

  const remove = useCallback(async () => {
    if (!track) return;
    await deleteTrackOffline(track.id);
    setDownloaded(false);
  }, [track]);

  return {
    supported: offlineDownloadsSupported(),
    downloaded,
    downloading,
    progress,
    error,
    download,
    remove,
  };
}
