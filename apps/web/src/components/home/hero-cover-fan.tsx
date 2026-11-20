"use client";

import Image from "next/image";
import { HERO_COVERS, type HeroCover } from "@/lib/hero-covers";

/**
 * The five-sleeve artwork cluster used by the Home hero.
 *
 * Two layouts:
 *  - `fan` (desktop): a 3D "cover flow" arc — five sleeves side by side,
 *    the two pairs turning away from the viewer and dropping back in Z,
 *    with brightness falloff for depth. Idle it drifts gently; hovering
 *    the cluster straightens the arc and lifts it (pure CSS, see
 *    `.hero-fan*` in globals.css).
 *  - `strip` (mobile): a compact filmstrip of the same five sleeves,
 *    slightly rotated and overlapped, sitting above the hero copy.
 *
 * Purely decorative — the surrounding hero already exposes the title,
 * description and play control to assistive tech.
 */

/** Geometry for the mobile filmstrip. */
const STRIP = [
  { size: 52, y: 7, rot: -12, z: 10 },
  { size: 58, y: 3, rot: -6, z: 20 },
  { size: 66, y: 0, rot: 0, z: 30 },
  { size: 58, y: 3, rot: 6, z: 20 },
  { size: 52, y: 7, rot: 12, z: 10 },
];

export function HeroCoverFan({
  covers = HERO_COVERS,
  variant = "fan",
  className = "",
}: {
  covers?: HeroCover[];
  variant?: "fan" | "strip";
  className?: string;
}) {
  const five = covers.slice(0, 5);

  if (variant === "strip") {
    return (
      <div aria-hidden className={`flex items-center justify-center ${className}`}>
        {five.map((cover, i) => {
          const g = STRIP[i];
          return (
            <div
              key={cover.src}
              className="relative -ms-2.5 overflow-hidden rounded-xl shadow-[0_10px_22px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/25 first:ms-0"
              style={{
                width: g.size,
                height: g.size,
                zIndex: g.z,
                transform: `translateY(${g.y}px) rotate(${g.rot}deg)`,
              }}
            >
              <Image
                src={cover.src}
                alt=""
                width={g.size * 2}
                height={g.size * 2}
                sizes="80px"
                draggable={false}
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-t from-black/30 via-transparent to-white/10" />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={`hero-fan relative shrink-0 ${className}`}
    >
      {/* Theme-tinted light behind the sleeves (halo vars, not fixed colors). */}
      <span className="hero-fan-glow pointer-events-none absolute inset-0" />
      {/* Soft contact shadow so the cluster sits on the hero instead of floating. */}
      <span className="hero-fan-shadow pointer-events-none" />

      {five.map((cover, i) => {
        return (
          <div
            key={cover.src}
            data-i={i}
            className="hero-fan-card absolute left-1/2 top-1/2 overflow-hidden rounded-2xl ring-1 ring-white/25"
          >
            <Image
              src={cover.src}
              alt=""
              fill
              sizes="(min-width: 1536px) 140px, 100px"
              draggable={false}
              className="object-cover"
            />
            {/* Glass edge + bottom scrim keep light sleeves legible on any theme. */}
            <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
          </div>
        );
      })}
    </div>
  );
}
