"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";

/** Queues `track` to play right after the current one. A quick flash on
 *  the icon is the only feedback — no toast, matching LikeButton's style. */
export function AddToQueueButton({ track, size = 16 }: { track: Song; size?: number }) {
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const hasQueue = usePlayerStore((s) => s.queue.length > 0);
  const { t } = useTranslation();
  const [justAdded, setJustAdded] = useState(false);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track, hasQueue ? "next" : "end");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 700);
  };

  return (
    <button
      onClick={onClick}
      aria-label={t("queue.playNext")}
      title={t("queue.playNext")}
      className={`shrink-0 transition-colors ${justAdded ? "text-primary" : "text-muted hover:text-foreground"}`}
    >
      <ListPlus size={size} />
    </button>
  );
}
