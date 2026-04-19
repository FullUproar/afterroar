'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SubNavItem {
  href: string;
  label: string;
}

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex-shrink-0 flex gap-1 overflow-x-auto pb-1 mb-2 border-b border-card-border sticky top-0 bg-background z-10">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== items[0].href && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              active
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-muted hover:text-foreground hover:bg-card-hover'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
