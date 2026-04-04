import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";

/* ------------------------------------------------------------------ */
/*  POST /api/connect/submit — receive a credential from a store owner */
/*  Public endpoint (no auth — the store owner isn't logged in yet).   */
/*  Credential is encrypted with AES-256-GCM before storage.          */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  let body: {
    store_slug: string;
    credential_type: string;
    credential: string;
    sender_name?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.store_slug || !body.credential || !body.credential_type) {
    return NextResponse.json(
      { error: "store_slug, credential_type, and credential are required" },
      { status: 400 },
    );
  }

  // Find the store by slug
  const store = await prisma.posStore.findFirst({
    where: { slug: body.store_slug },
    select: { id: true, settings: true },
  });

  if (!store) {
    // Don't reveal whether the store exists — accept silently
    console.log(`[Connect] Credential submitted for unknown slug: ${body.store_slug}`);
    return NextResponse.json({ ok: true });
  }

  // Encrypt the credential
  const { encrypted, iv, tag } = encryptCredential(body.credential);

  // Store in the store's settings as a pending credential
  const settings = (store.settings ?? {}) as Record<string, unknown>;
  const pendingCredentials = (settings.pending_credentials ?? []) as Array<Record<string, unknown>>;

  pendingCredentials.push({
    type: body.credential_type,
    encrypted,
    iv,
    tag,
    sender_name: body.sender_name || null,
    submitted_at: new Date().toISOString(),
    consumed: false,
  });

  await prisma.posStore.update({
    where: { id: store.id },
    data: {
      settings: JSON.parse(JSON.stringify({
        ...settings,
        pending_credentials: pendingCredentials,
      })),
      updated_at: new Date(),
    },
  });

  console.log(
    `[Connect] ${body.credential_type} credential received for store ${body.store_slug} from ${body.sender_name || "unknown"}`,
  );

  return NextResponse.json({ ok: true });
}
