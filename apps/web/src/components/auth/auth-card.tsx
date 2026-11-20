import Link from "next/link";
import { forwardRef } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <Link
          href="/"
          className="brand-wordmark font-brand mb-6 block text-center text-2xl font-semibold"
        >
          MELUNE
        </Link>
        <h1 className="text-center text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

/**
 * Text field used by every auth form.
 *
 * Must forward the ref: react-hook-form's `register()` returns a `ref` that
 * reads the DOM value. A plain function component silently drops it, which
 * made every field validate as empty ("Required") even when the user had
 * typed something.
 */
export const AuthField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
  }
>(function AuthField({ label, error, className, ...props }, ref) {
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1.5 block text-muted">{label}</span>
      <input
        {...props}
        ref={ref}
        className={`w-full rounded-xl border border-border bg-surfaceElevated px-3.5 py-2.5 text-foreground outline-none transition focus:border-primary ${className ?? ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
});

export function AuthSubmitButton({
  children,
  isLoading,
}: {
  children: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="bg-codex-gradient w-full rounded-xl py-2.5 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "Please wait…" : children}
    </button>
  );
}
