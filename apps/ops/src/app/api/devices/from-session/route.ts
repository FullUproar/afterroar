/**
 * POST /api/devices/from-session
 *
 * Companion to the pairing-code flow. Used by the register's "Sign in with
 * Passport" path: the user signs in to Passport in the system browser, lands
 * on /auth/register-link, which calls this endpoint with the active session.
 *
 * Auth: NextAuth session (the user is signed in to Passport in the browser
 * that opened to do the link).
 *
 * Request: { device_id: string, display_name?: string }
 * Response: { token: string, device_id: string, store: { id, name } }
 *
 * The plaintext token is shown ONCE here, then served back to the register
 * via the deep-link redirect on /auth/register-link. After that it lives
 * only on the device.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { randomBytes, createHash } from "node:crypto";

function mintToken(): { plaintext: string; hash: string } {
  const plaintext = `ardv_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export async function POST(req: NextRequest) {
  try {
    const { staff, storeId } = await requireStaff();

    let body: { device_id?: string; display_name?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const deviceId = body.device_id?.trim();
    if (!deviceId) {
      return NextResponse.json({ error: "device_id required" }, { status: 400 });
    }

    const { plaintext, hash } = mintToken();
    const displayName = body.display_name?.trim() || `${staff.name}'s register`;

    const device = await prisma.registerDevice.create({
      data: {
        store_id: storeId,
        paired_by: staff.user_id,
        display_name: displayName,
        token_hash: hash,
        device_id: deviceId,
      },
    });

    const store = await prisma.posStore.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 500 });
    }

    return NextResponse.json({
      token: plaintext,
      device_id: device.id,
      store,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
