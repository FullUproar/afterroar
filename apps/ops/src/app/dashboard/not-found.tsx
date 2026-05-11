import Link from "next/link";

/**
 * Dashboard-scoped 404. Renders inside the dashboard layout so the
 * sidebar / mobile nav / training banner stay visible. Without this
 * file, the root not-found takes over and the entire shell drops away
 * — bad UX when a staff member fat-fingers a URL mid-shift.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center space-y-4">
      <p className="font-mono uppercase text-orange tracking-[0.3em] text-xs font-bold">
        Console · 404
      </p>
      <h1 className="font-display font-bold text-3xl text-ink leading-none">
        That page isn&apos;t here
      </h1>
      <p className="text-ink-soft text-sm max-w-md">
        The dashboard route you tried doesn&apos;t exist. Use the sidebar to
        navigate, or jump to a common destination below.
      </p>
      <div className="flex flex-wrap gap-2 justify-center pt-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 bg-orange text-void font-display font-bold uppercase tracking-wider text-xs hover:bg-yellow transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/dashboard/register"
          className="inline-flex items-center px-4 py-2 border border-rule-hi bg-panel text-ink font-display font-semibold uppercase tracking-wider text-xs hover:bg-panel-hi transition-colors"
        >
          Register
        </Link>
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center px-4 py-2 border border-rule-hi bg-panel text-ink font-display font-semibold uppercase tracking-wider text-xs hover:bg-panel-hi transition-colors"
        >
          Inventory
        </Link>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center px-4 py-2 border border-rule-hi bg-panel text-ink font-display font-semibold uppercase tracking-wider text-xs hover:bg-panel-hi transition-colors"
        >
          Customers
        </Link>
      </div>
    </div>
  );
}
