import type { ElementType, HTMLAttributes, ReactNode } from "react";

type GlassPanelProps = Omit<HTMLAttributes<HTMLElement>, "className" | "children"> & {
  /** Rendered element. Defaults to a `<section>`. */
  as?: ElementType;
  /** Adds a subtle lift + glow on hover (for clickable cards). */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * The shared "liquid glass" surface: translucent fill, backdrop blur and a
 * purple→blue gradient border. The look lives in `.glass-panel`
 * (globals.css); this only composes the class names.
 */
export function GlassPanel({
  as: Tag = "section",
  interactive = false,
  className = "",
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <Tag
      className={`glass-panel ${interactive ? "glass-panel-interactive" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Title row for a panel: heading on the start side, optional action on the end. */
export function PanelHeader({
  title,
  action,
  id,
}: {
  title: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {/* Brand-gradient heading — the shared "section title" look for
          every panel (uses the .text-gradient utility from globals.css). */}
      <h2 id={id} className="text-gradient text-lg font-semibold">
        {title}
      </h2>
      {action}
    </div>
  );
}
