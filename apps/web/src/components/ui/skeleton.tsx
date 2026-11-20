export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-md bg-surfaceElevated motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Row placeholder that matches TrackList rows. */
export function TrackRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading songs"
      className="divide-y divide-border rounded-2xl border border-border"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder that matches StatsPanel's row of stat items. */
export function StatsPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading stats" className="glass-panel flex items-center gap-6 rounded-2xl p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tile placeholders that match MediaCard / SongCard grids and shelves. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ShelfSkeleton({ title = true }: { title?: boolean }) {
  return (
    <section role="status" aria-label="Loading">
      {title && <Skeleton className="mb-4 h-6 w-44" />}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-40 shrink-0 sm:w-44">
            <Skeleton className="h-40 w-40 rounded-xl sm:h-44 sm:w-44" />
            <Skeleton className="mt-3 h-3.5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}
