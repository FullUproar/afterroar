import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/invite-validate?code=XYZ
 *
 * Cheap pre-signup validation so the /signup page can show clear
 * "invalid code" / "expired code" / "valid" messaging without
 * trying to consume the code first. Read-only; does NOT mark used.
 *
 * Returns: { valid: boolean, reason?: string }
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('code')?.trim().toUpperCase() || '';
  if (!raw) {
    return NextResponse.json({ valid: false, reason: 'no_code' });
  }

  const invite = await prisma.inviteCode.findUnique({ where: { code: raw } });
  if (!invite) {
    return NextResponse.json({ valid: false, reason: 'not_found' });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }
  if (invite.usedCount >= invite.maxUses) {
    return NextResponse.json({ valid: false, reason: 'used' });
  }
  return NextResponse.json({ valid: true });
}
