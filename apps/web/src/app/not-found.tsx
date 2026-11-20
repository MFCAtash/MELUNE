import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="bg-melune-gradient bg-clip-text text-6xl font-bold text-transparent">
        404
      </p>
      <p className="text-muted">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary"
      >
        Back home
      </Link>
    </main>
  );
}
