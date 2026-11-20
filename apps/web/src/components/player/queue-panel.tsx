"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, GripVertical, ListX, X } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { formatDuration } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { QueueColorStrip } from "./queue-color-strip";

const iconButton =
  "rounded-md p-1 text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

/**
 * The queue is fully editable: drag a row to reorder it, use the up/down
 * chevrons, remove a track, or press Alt + Up/Down while a row is focused
 * (keyboard-only equivalent of the drag). "Clear upcoming" leaves the
 * currently playing track alone and drops everything queued after it.
 */
export function QueuePanel({ onClose }: { onClose: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveInQueue = usePlayerStore((s) => s.moveInQueue);
  const clearUpcoming = usePlayerStore((s) => s.clearUpcoming);
  const { t } = useTranslation();

  const dragIndexRef = useRef<number | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  // Set right before a reorder so focus follows the moved row instead of
  // staying on whatever DOM node now happens to sit at the old position.
  const pendingFocusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocusIndexRef.current === null) return;
    itemRefs.current[pendingFocusIndexRef.current]?.focus();
    pendingFocusIndexRef.current = null;
  }, [queue]);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= queue.length) return;
    pendingFocusIndexRef.current = target;
    moveInQueue(index, target);
  };

  const upcomingCount = Math.max(queue.length - currentIndex - 1, 0);

  return (
    <div className="fixed bottom-24 end-4 z-40 w-80 max-w-[90vw] rounded-2xl border border-border bg-surface p-4 shadow-2xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t("queue.title")}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {upcomingCount > 0 && (
            <button
              onClick={clearUpcoming}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
            >
              <ListX size={14} />
              {t("queue.clearUpcoming")}
            </button>
          )}
          <button onClick={onClose} className="text-sm text-muted hover:text-foreground">
            {t("common.close")}
          </button>
        </div>
      </div>

      {queue.length > 0 && <p className="mb-2 text-xs text-muted/70">{t("queue.reorderHint")}</p>}

      <QueueColorStrip size="md" className="mb-3" />

      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {queue.map((track, index) => {
          const isCurrent = index === currentIndex;
          return (
            <li
              key={`${track.id}-${index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              draggable
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                dragIndexRef.current = null;
                if (from === null || from === index) return;
                pendingFocusIndexRef.current = index;
                moveInQueue(from, index);
              }}
              onKeyDown={(e) => {
                if (!e.altKey) return;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(index, -1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(index, 1);
                }
              }}
              tabIndex={0}
              aria-label={t("queue.trackPosition", { index: index + 1, total: queue.length })}
              className={`group flex items-center gap-1 rounded-lg px-1 py-1 outline-none transition focus-visible:ring-1 focus-visible:ring-primary ${
                isCurrent ? "bg-surfaceElevated" : "hover:bg-surfaceElevated"
              }`}
            >
              <span className="shrink-0 cursor-grab text-muted/40 group-hover:text-muted" aria-hidden>
                <GripVertical size={14} />
              </span>

              <button
                onClick={() => playQueue(queue, index)}
                title={t("queue.playFromHere")}
                className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-start text-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                    {track.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDuration(track.duration)}</span>
                </div>
                <div className="truncate text-xs text-muted">
                  {isCurrent ? t("queue.nowPlaying") : track.artist.name}
                </div>
              </button>

              <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("queue.moveUp")}
                  className={iconButton}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === queue.length - 1}
                  aria-label={t("queue.moveDown")}
                  className={iconButton}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => removeFromQueue(index)}
                  aria-label={t("queue.remove")}
                  className={iconButton}
                >
                  <X size={14} />
                </button>
              </span>
            </li>
          );
        })}

        {queue.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            <p>{t("queue.empty")}</p>
            <p className="mt-1 text-xs">{t("queue.emptyHint")}</p>
          </li>
        )}
      </ul>
    </div>
  );
}
