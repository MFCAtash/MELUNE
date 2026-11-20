import Link from "next/link";

/** An empty screen is an invitation to act — always give one next step. */
export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  /** Optional decorative glyph (see `components/ui/empty-illustrations.tsx`)
   *  rendered above the heading. Omit for a plain text-only empty state —
   *  existing callers that don't pass one are unaffected. */
  illustration?: React.ReactNode;
}) {
  const buttonClass =
    "bg-codex-gradient mt-5 inline-flex rounded-xl px-5 py-2.5 text-sm font-medium text-white";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      {illustration}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className={buttonClass}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={buttonClass}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
