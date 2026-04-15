/**
 * Canonical scope list for Afterroar Connect.
 *
 * Scopes are the unit of consent between a Passport holder and an Entity
 * (store / venue / publisher / creator). They map 1:1 to the data slices
 * the customer-lookup API returns. Add new scopes here, then update the
 * lookup route + UI in lockstep.
 */

export type ConnectScope = 'identity' | 'wishlist' | 'library' | 'badges' | 'points';

export const CONNECT_SCOPES: readonly ConnectScope[] = [
  'identity',
  'wishlist',
  'library',
  'badges',
  'points',
];

export const VALID_SCOPES: ReadonlySet<string> = new Set(CONNECT_SCOPES);

export interface ScopeMeta {
  id: ConnectScope;
  icon: string;
  label: string;
  /** Customer-facing description on the consent approval screen. */
  description: string;
  /** Default-on when a store is creating a request. */
  defaultOn: boolean;
  /** "Coming soon" hint shown next to the scope in store-facing UI, if any. */
  comingSoon?: string;
}

export const SCOPE_META: Record<ConnectScope, ScopeMeta> = {
  identity: {
    id: 'identity',
    icon: '👤',
    label: 'Identity',
    description: 'Your name, email, and Passport code',
    defaultOn: true,
  },
  wishlist: {
    id: 'wishlist',
    icon: '⭐',
    label: 'Wishlist',
    description: 'Games you want — so they can match to stock',
    defaultOn: true,
    comingSoon: 'Real-time stock matching coming soon',
  },
  library: {
    id: 'library',
    icon: '📚',
    label: 'Library',
    description: 'Games you already own — to avoid duplicate suggestions',
    defaultOn: false,
    comingSoon: 'Collection-based recommendations coming soon',
  },
  badges: {
    id: 'badges',
    icon: '🏅',
    label: 'Badges & reputation',
    description: 'Your verified status and badges',
    defaultOn: false,
    comingSoon: 'Cross-store verification coming soon',
  },
  points: {
    id: 'points',
    icon: '🎯',
    label: 'Loyalty points',
    description: "So they can award and read points at their store",
    defaultOn: true,
    comingSoon: 'Federated points across stores coming soon',
  },
};

export function filterValidScopes(scopes: unknown): ConnectScope[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((s): s is ConnectScope => typeof s === 'string' && VALID_SCOPES.has(s));
}
