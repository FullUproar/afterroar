import Link from "next/link";

/**
 * Branded 404 for Store Ops. Manus flagged the default Next.js
 * not-found as a bare page that drops the entire dashboard shell and
 * leaves staff with no obvious way back. This is the root-level
 * fallback for any unknown URL outside the /dashboard tree.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-void text-ink px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="font-mono uppercase text-orange tracking-[0.3em] text-xs font-bold">
          Console · 404
        </p>
        <h1 className="font-display font-bold text-5xl text-ink leading-none">
          Not found
        </h1>
        <p className="text-ink-soft text-sm">
          That URL doesn&apos;t map to anything in Store Ops. The page may have
          moved, the link may be wrong, or the operation may have completed.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-orange text-void font-display font-bold uppercase tracking-wider text-sm hover:bg-yellow transition-colors"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/dashboard/register"
            className="inline-flex items-center justify-center px-6 py-3 border border-rule-hi bg-panel text-ink font-display font-semibold uppercase tracking-wider text-sm hover:bg-panel-hi transition-colors"
          >
            Open Register
          </Link>
        </div>
      </div>
    </main>
  );
}
