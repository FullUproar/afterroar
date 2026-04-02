import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { getTenantClient, type TenantPrismaClient } from "./tenant-prisma";
import {
  type Role,
  type Permission,
  type RolePermissionOverrides,
  type FeatureModule,
  type StorePlan,
  hasPermission,
  hasFeature,
} from "./permissions";

/* ------------------------------------------------------------------ */
/*  requireStaff() — shared auth + tenant scoping helper               */
/*  Replaces the 16× repeated auth boilerplate in every API route.     */
/*  Returns { session, staff, db } where db is store-scoped.           */
/* ------------------------------------------------------------------ */

export interface StaffContext {
  session: { user: { id: string; email?: string | null } };
  staff: {
    id: string;
    user_id: string;
    store_id: string;
    role: string;
    name: string;
    active: boolean;
  };
  storeId: string;
  role: Role;
  db: TenantPrismaClient;
  /** Store-level role permission overrides */
  roleOverrides: RolePermissionOverrides | null;
  /** Check a permission with store overrides applied */
  can: (permission: Permission) => boolean;
  /** Check if a feature module is available on this store's plan */
  hasModule: (feature: FeatureModule) => boolean;
}

export class AuthError {
  status = 401 as const;
  message = "Unauthorized";
}

export class NoStoreError {
  status = 403 as const;
  message = "No store found";
}

export class ForbiddenError {
  status = 403 as const;
  message: string;
  constructor(permission: string) {
    this.message = `Forbidden: requires ${permission} permission`;
  }
}

export class FeatureNotAvailableError {
  status = 403 as const;
  message: string;
  constructor(feature: string) {
    this.message = `This feature requires an upgrade. Module: ${feature}`;
  }
}

/**
 * Authenticate user and return tenant-scoped context.
 * Throws AuthError or NoStoreError on failure.
 */
export async function requireStaff(): Promise<StaffContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError();
  }

  const staffWithStore = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
    include: { store: { select: { settings: true } } },
  });
  if (!staffWithStore) {
    throw new NoStoreError();
  }

  // Extract store settings, then strip the relation for the public staff object
  const storeSettings = (staffWithStore.store?.settings ?? {}) as Record<string, unknown>;
  const staff = {
    id: staffWithStore.id,
    user_id: staffWithStore.user_id,
    store_id: staffWithStore.store_id,
    role: staffWithStore.role,
    name: staffWithStore.name,
    active: staffWithStore.active,
  };

  const db = getTenantClient(staff.store_id);
  const role = staff.role as Role;
  const settings = storeSettings;
  const roleOverrides = (settings.role_permissions ?? null) as RolePermissionOverrides | null;
  const plan = ((settings.plan as string) || "enterprise") as StorePlan;
  const addons = ((settings.addons as string[]) || []) as FeatureModule[];

  return {
    session: session as StaffContext["session"],
    staff,
    storeId: staff.store_id,
    role,
    db,
    roleOverrides,
    can: (permission: Permission) => hasPermission(role, permission, roleOverrides),
    hasModule: (feature: FeatureModule) => hasFeature(plan, addons, feature),
  };
}

/**
 * Authenticate + check permission. Returns tenant-scoped context.
 */
export async function requirePermission(
  permission: Permission
): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.can(permission)) {
    throw new ForbiddenError(permission);
  }
  return ctx;
}

/**
 * Authenticate + check feature module availability.
 */
export async function requireFeature(
  feature: FeatureModule
): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.hasModule(feature)) {
    throw new FeatureNotAvailableError(feature);
  }
  return ctx;
}

/**
 * Authenticate + check both permission and feature.
 */
export async function requirePermissionAndFeature(
  permission: Permission,
  feature: FeatureModule,
): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.can(permission)) {
    throw new ForbiddenError(permission);
  }
  if (!ctx.hasModule(feature)) {
    throw new FeatureNotAvailableError(feature);
  }
  return ctx;
}

/**
 * Convert auth errors to NextResponse.
 * Use in route handlers: try { ... } catch (e) { return handleAuthError(e); }
 */
export function handleAuthError(
  error: unknown
): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof NoStoreError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof FeatureNotAvailableError) {
    return NextResponse.json(
      { error: error.message, upgrade_required: true },
      { status: error.status },
    );
  }
  // Log and return 500 for unknown errors instead of crashing the route
  console.error("[API Error]", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
