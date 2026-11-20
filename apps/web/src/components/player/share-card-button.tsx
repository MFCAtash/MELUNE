"use client";

import { useState } from "react";
import { ImageDown, Loader2 } from "lucide-react";

const CARD_SIZE = 1080;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function drawShareCard(canvas: HTMLCanvasElement, title: string, artist: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;

  const gradient = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE);
  gradient.addColorStop(0, "#8B5CF6");
  gradient.addColorStop(1, "#3B82F6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // Soft decorative circles — purely aesthetic, keeps the card from
  // looking like a flat color swatch.
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(CARD_SIZE * 0.85, CARD_SIZE * 0.15, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CARD_SIZE * 0.1, CARD_SIZE * 0.9, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "alphabetic";

  ctx.font = "600 44px sans-serif";
  ctx.fillText("NOW PLAYING", 90, 160);

  ctx.font = "bold 76px sans-serif";
  const afterTitleY = wrapText(ctx, title, 90, 280, CARD_SIZE - 180, 88);

  ctx.font = "44px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(artist, 90, afterTitleY + 10);

  ctx.font = "600 36px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("MELUNE", 90, CARD_SIZE - 80);
  ctx.font = "32px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("Your Music. Smarter.", 90, CARD_SIZE - 40);
}

export function ShareCardButton({ title, artist }: { title: string; artist: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    setIsGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      drawShareCard(canvas, title, artist);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-codex-music.png`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      title="Download a shareable card"
      className="hover:text-foreground disabled:opacity-50"
    >
      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ImageDown size={20} />}
    </button>
  );
}
