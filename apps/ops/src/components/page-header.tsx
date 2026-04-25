"use client";

import { useRouter } from "next/navigation";

interface PageHeaderProps {
  title: string;
  /** Optional small breadcrumb / pre-title — mono caps, tracked. */
  crumb?: string;
  /** Optional one-liner under the title. */
  desc?: string;
  /** Where to navigate on back. Falls back to history. */
  backHref?: string;
  /** Right-side actions (Buttons, dropdowns, etc.) */
  action?: React.ReactNode;
}

/**
 * Operator Console page header — used at the top of every interior page.
 * - Display title in Antonio
 * - Optional mono-caps breadcrumb above
 * - Back arrow on mobile/kiosk (hidden on desktop where Sidebar handles nav)
 */
export function PageHeader({ title, crumb, desc, backHref, action }: PageHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {/* Back arrow — visible below desktop */}
        <button
          onClick={handleBack}
          className="lg:hidden flex items-center justify-center h-12 w-12 shrink-0 text-ink-soft hover:text-ink active:bg-panel transition-colors"
          aria-label="Go back"
          style={{ marginTop: '-0.4rem', marginLeft: '-0.6rem' }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
            <path d="M14 6 L8 12 L14 18" />
          </svg>
        </button>
        <div className="min-w-0">
          {crumb ? (
            <p
              className="font-mono uppercase font-semibold mb-1 text-ink-faint"
              style={{ fontSize: '0.6rem', letterSpacing: '0.28em' }}
            >
              {crumb}
            </p>
          ) : null}
          <h1
            className="font-display text-ink truncate leading-none"
            style={{
              fontWeight: 600,
              fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
              letterSpacing: '0.005em',
            }}
          >
            {title}
          </h1>
          {desc ? (
            <p
              className="text-ink-soft mt-2 max-w-[60ch]"
              style={{ fontSize: '0.88rem', lineHeight: 1.5 }}
            >
              {desc}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
