export type Role = "owner" | "manager" | "cashier";

export type Permission =
  | "checkout"
  | "inventory.view"
  | "inventory.adjust"
  | "customers.view"
  | "customers.edit"
  | "customers.credit"
  | "trade_ins"
  | "events.checkin"
  | "events.manage"
  | "reports"
  | "cash_flow"
  | "staff.manage"
  | "store.settings";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "checkout",
    "inventory.view",
    "inventory.adjust",
    "customers.view",
    "customers.edit",
    "customers.credit",
    "trade_ins",
    "events.checkin",
    "events.manage",
    "reports",
    "cash_flow",
    "staff.manage",
    "store.settings",
  ],
  manager: [
    "checkout",
    "inventory.view",
    "inventory.adjust",
    "customers.view",
    "customers.edit",
    "customers.credit",
    "trade_ins",
    "events.checkin",
    "events.manage",
    "reports",
  ],
  cashier: [
    "checkout",
    "inventory.view",
    "customers.view",
    "events.checkin",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function canAccess(role: Role, path: string): boolean {
  const routePermissions: Record<string, Permission> = {
    "/dashboard": "checkout", // everyone can see dashboard
    "/dashboard/checkout": "checkout",
    "/dashboard/inventory": "inventory.view",
    "/dashboard/trade-ins": "trade_ins",
    "/dashboard/customers": "customers.view",
    "/dashboard/events": "events.checkin",
    "/dashboard/reports": "reports",
    "/dashboard/cash-flow": "cash_flow",
    "/dashboard/staff": "staff.manage",
    "/dashboard/settings": "store.settings",
  };

  // Find the matching route (longest prefix match)
  const matchedRoute = Object.keys(routePermissions)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchedRoute) return true; // unknown routes are accessible
  return hasPermission(role, routePermissions[matchedRoute]);
}

// Nav items with required permissions
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/checkout", label: "Checkout", icon: "◈", permission: "checkout" },
  { href: "/dashboard", label: "Dashboard", icon: "⌂", permission: "checkout" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "▦", permission: "inventory.view" },
  { href: "/dashboard/trade-ins", label: "Trade-Ins", icon: "⇄", permission: "trade_ins" },
  { href: "/dashboard/customers", label: "Customers", icon: "♟", permission: "customers.view" },
  { href: "/dashboard/events", label: "Events", icon: "★", permission: "events.checkin" },
  { href: "/dashboard/reports", label: "Reports", icon: "◩", permission: "reports" },
  { href: "/dashboard/cash-flow", label: "Cash Flow", icon: "◎", permission: "cash_flow" },
  { href: "/dashboard/staff", label: "Staff", icon: "⊞", permission: "staff.manage" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙", permission: "store.settings" },
];
