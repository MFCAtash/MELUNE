"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { coverGradient, initialOf } from "@/lib/cover";

/**
 * Artwork tile. Shows the real image when there is one — fading in from a
 * blurred, on-brand gradient placeholder so tiles never pop in — and falls
 * back to the gradient + initial when there is no image or it fails to
 * load. Size/shape come from `className`.
 *
 * (There is no blurhash in the API yet, so the placeholder is the same
 * deterministic gradient used for missing artwork.)
 */
export function Cover({
  title,
  url,
  seed,
  className = "h-full w-full rounded-xl text-3xl",
}: {
  title: string;
  url?: string | null;
  /** Override the gradient seed (e.g. use the playlist id for stability). */
  seed?: string;
  className?: string;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Images served from cache can finish loading before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (url && img && img.complete && img.naturalWidth > 0) setLoadedUrl(url);
  }, [url]);

  const gradient = coverGradient(seed ?? title);

  if (!url || failedUrl === url) {
    return (
      <div
        aria-hidden
        style={{ background: gradient }}
        className={`flex items-center justify-center font-bold text-foreground ${className}`}
      >
        {initialOf(title)}
      </div>
    );
  }

  const loaded = loadedUrl === url;

  return (
    <div aria-hidden style={{ background: gradient }} className={`relative overflow-hidden ${className}`}>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold text-foreground transition-opacity duration-300 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      >
        {initialOf(title)}
      </span>
      <Image
        ref={imgRef}
        src={url}
        alt=""
        fill
        sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
        loading="lazy"
        onLoad={() => setLoadedUrl(url)}
        onError={() => setFailedUrl(url)}
        className={`object-cover motion-safe:transition-all motion-safe:duration-500 ${
          loaded ? "scale-100 opacity-100 blur-0" : "scale-105 opacity-0 blur-md"
        }`}
      />
    </div>
  );
}
