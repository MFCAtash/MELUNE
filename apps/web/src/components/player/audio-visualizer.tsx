export function AudioVisualizer({
  isPlaying,
  className = "",
}: {
  isPlaying: boolean;
  className?: string;
}) {
  const bars = [0, 1, 2, 3];
  return (
    <div className={`flex h-4 items-end gap-0.5 ${className}`} aria-hidden="true">
      {bars.map((i) => (
        <span
          key={i}
          className={`w-0.5 rounded-full bg-primary ${
            isPlaying ? "animate-visualizer-bar" : ""
          }`}
          style={{
            height: isPlaying ? undefined : "20%",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
