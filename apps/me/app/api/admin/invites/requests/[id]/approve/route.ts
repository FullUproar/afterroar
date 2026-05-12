import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/admin/invites/requests/[id]/approve
 *
 * Admin-only. Approves a pending InviteRequest:
 *   1. Mints a fresh InviteCode (single-use, no expiry by default)
 *   2. Links the code to the request
 *   3. Sends the requester an email with the code + link
 *   4. Flips request status to 'approved'
 *
 * Idempotent — if the request is already 'approved' or 'invited',
 * returns the existing inviteCode without re-minting or re-sending.
 *
 * Body: {
 *   expiresInDays?: number,     // default null = no expiry
 *   personalNote?: string,      // optional message included in email
 * }
 *
 * POST /api/admin/invites/requests/[id]/approve?reject=true
 * marks rejected without sending email.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const reject = request.nextUrl.searchParams.get('reject') === 'true';

  const inviteRequest = await prisma.inviteRequest.findUnique({ where: { id } });
  if (!inviteRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (reject) {
    if (inviteRequest.status === 'pending') {
      await prisma.inviteRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedByUserId: session.user.id ?? null,
        },
      });
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // Idempotent — return existing code if already approved.
  if (inviteRequest.inviteCodeId) {
    const existing = await prisma.inviteCode.findUnique({
      where: { id: inviteRequest.inviteCodeId },
    });
    return NextResponse.json({
      ok: true,
      status: inviteRequest.status,
      code: existing?.code ?? null,
    });
  }

  let body: { expiresInDays?: number; personalNote?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + Number(body.expiresInDays) * 24 * 60 * 60 * 1000)
    : null;
  const code = mintCode();

  const invite = await prisma.inviteCode.create({
    data: {
      code,
      batch: 'request_approval',
      maxUses: 1,
      expiresAt,
      notes: `Approved from InviteRequest ${id}`,
      createdById: session.user.id ?? null,
    },
  });

  await prisma.inviteRequest.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id ?? null,
      inviteCodeId: invite.id,
    },
  });

  // Send the email — fire-and-forget. If it fails, admin can manually
  // re-send by hitting /resend.
  void sendInviteEmail({
    to: inviteRequest.email,
    displayName: inviteRequest.displayName,
    code,
    personalNote: body.personalNote?.trim() || null,
    expiresAt,
  });

  return NextResponse.json({ ok: true, status: 'approved', code });
}

async function sendInviteEmail(args: {
  to: string;
  displayName: string | null;
  code: string;
  personalNote: string | null;
  expiresAt: Date | null;
}) {
  const url = `https://www.afterroar.me/signup?code=${encodeURIComponent(args.code)}`;
  const greeting = args.displayName ? `Hey ${args.displayName}` : 'Hey there';
  const expiry = args.expiresAt
    ? `\n\nThis code expires on ${args.expiresAt.toLocaleDateString()}.`
    : '';
  const personalLine = args.personalNote ? `\n\n${args.personalNote}\n` : '';

  const text = `${greeting},

Welcome to Afterroar. Your Passport is approved — use the code below at signup.

Your invite code: ${args.code}

Or jump straight to signup with the code prefilled:
${url}${expiry}${personalLine}

Questions? Reply to this email.

— Afterroar`;

  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 540px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #1a1a1a;">Welcome to Afterroar</h1>
    <p style="font-size: 15px; line-height: 1.55; margin: 0 0 18px;">${greeting},</p>
    <p style="font-size: 15px; line-height: 1.55; margin: 0 0 14px;">
      Your Passport is approved. Use the code below at signup.
    </p>
    <div style="background:#fff5e6;border:2px solid #ff6b35;padding:18px 22px;font-size:22px;font-weight:800;letter-spacing:0.12em;text-align:center;font-family:'JetBrains Mono', ui-monospace, monospace;margin:18px 0;color:#1a1a1a">
      ${args.code}
    </div>
    <p style="margin: 0 0 24px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#ff6b35;color:#fff;text-decoration:none;font-weight:600;border-radius:4px;">
        Sign up with this code
      </a>
    </p>
    ${args.personalNote ? `<p style="font-size:14px;line-height:1.55;background:#f4f4f4;padding:12px 14px;border-radius:6px;margin:18px 0;color:#444">${escapeHtml(args.personalNote)}</p>` : ''}
    ${args.expiresAt ? `<p style="font-size:13px;color:#666;margin:14px 0 0;">This code expires on ${args.expiresAt.toLocaleDateString()}.</p>` : ''}
    <p style="font-size: 13px; color: #666; line-height: 1.5; margin: 14px 0 0;">
      Questions? Just reply.
    </p>
    <p style="font-size: 12px; color: #999; line-height: 1.5; margin: 22px 0 0;">
      — Afterroar
    </p>
  </body>
</html>`.trim();

  await sendEmail({ to: args.to, subject: 'Your Afterroar invite', html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mintCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `AFTERROAR-${suffix}`;
}
