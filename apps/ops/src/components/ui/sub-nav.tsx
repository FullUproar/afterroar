'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SubNavItem {
  href: string;
  label: string;
  badge?: { kind: 'warn' | 'err' | 'live'; text: string };
}

/**
 * Operator Console sub-section nav — horizontal tab strip used inside a page
 * to switch between sub-views (e.g. Inventory / Catalog / Deck Builder).
 * Mono caps text, orange bottom-rule indicator on active, finger-tip 52px tap target.
 */
export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div
      className="shrink-0 flex items-end gap-0 overflow-x-auto bg-slate sticky top-0 z-10"
      style={{
        borderBottom: '1px solid var(--rule)',
        paddingLeft: 0,
        paddingRight: 0,
        marginBottom: '0.85rem',
        scrollbarWidth: 'none',
      }}
    >
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== items[0].href && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center gap-2 whitespace-nowrap"
            style={{
              padding: '0.95rem 1.1rem',
              minHeight: 52,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: active ? 'var(--orange)' : 'var(--ink-soft)',
              borderBottom: active ? '2px solid var(--orange)' : '2px solid transparent',
              background: 'transparent',
              transition: 'color 0.15s, border-color 0.15s, background 0.15s',
              textDecoration: 'none',
            }}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.55rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  padding: '1px 5px',
                  border: `1px solid ${
                    item.badge.kind === 'warn'
                      ? 'rgba(251,219,101,.35)'
                      : item.badge.kind === 'err'
                        ? 'rgba(214,90,90,.35)'
                        : 'var(--orange)'
                  }`,
                  color:
                    item.badge.kind === 'warn'
                      ? 'var(--yellow)'
                      : item.badge.kind === 'err'
                        ? 'var(--red)'
                        : 'var(--orange)',
                  background:
                    item.badge.kind === 'warn'
                      ? 'var(--yellow-mute)'
                      : item.badge.kind === 'err'
                        ? 'var(--red-mute)'
                        : 'var(--orange-mute)',
                }}
              >
                {item.badge.text}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
