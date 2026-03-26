import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { getTenantClient, type TenantPrismaClient } from "./tenant-prisma";
import { type Role, type Permission, hasPermission } from "./permissions";

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

/**
 * Authenticate user and return tenant-scoped context.
 * Throws AuthError or NoStoreError on failure.
 */
export async function requireStaff(): Promise<StaffContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError();
  }

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
  });
  if (!staff) {
    throw new NoStoreError();
  }

  const db = getTenantClient(staff.store_id);

  return {
    session: session as StaffContext["session"],
    staff,
    storeId: staff.store_id,
    role: staff.role as Role,
    db,
  };
}

/**
 * Authenticate + check permission. Returns tenant-scoped context.
 */
export async function requirePermission(
  permission: Permission
): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!hasPermission(ctx.role, permission)) {
    throw new ForbiddenError(permission);
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
  // Re-throw unknown errors
  throw error;
}
