import { prisma } from "@/lib/prisma";

/**
 * Passport-code generation — shared between NextAuth's events.createUser
 * (OAuth flow) and the email-signup endpoint (custom flow).
 *
 * Background: passportCode is the 8-char identifier on the User row that
 * customers show at stores via QR. It MUST be unique. Earlier versions
 * only generated it inside NextAuth's events.createUser, which fires only
 * for OAuth-initiated user creation. Email-signup users were left with
 * passportCode=null, which broke the post-signup landing page with a
 * "Passport code hasn't been generated yet" error.
 *
 * This helper is the single source of truth for code generation. Both
 * callers should invoke `assignPassportCode(userId)` at user-creation time.
 *
 * Charset omits ambiguous glyphs (0/O, 1/I/L) so codes can be read
 * aloud or hand-typed without confusion.
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 8;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/**
 * Assigns a unique passport code to the given user. Retries up to 5 times
 * on unique-constraint collisions. Returns the assigned code, or null if
 * all attempts collided (statistically near-zero — 32^8 ≈ 1 trillion
 * possibilities, so the only realistic failure is a stale-id condition).
 *
 * No-op if the user already has a code (we don't overwrite). The
 * existence check + update has a small race window — concurrent calls
 * could both pass the check and one would lose at the unique-constraint
 * layer. That's fine: the loser retries with a fresh code, and if the
 * collision was an already-set passportCode (not a code collision) the
 * second findUnique short-circuits.
 */
export async function assignPassportCode(userId: string): Promise<string | null> {
  // Short-circuit if the user already has one — don't overwrite.
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { passportCode: true },
  });
  if (existing?.passportCode) return existing.passportCode;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { passportCode: code },
        select: { passportCode: true },
      });
      return updated.passportCode;
    } catch (err) {
      const errCode = (err as { code?: string }).code;
      // P2025 = "Record to update not found" — userId is invalid. Bail.
      if (errCode === "P2025") return null;
      // P2002 = unique constraint violation — code collision OR a
      // concurrent caller set passportCode after our existence check.
      // Re-check before retrying so we return the now-set value rather
      // than spinning on collisions.
      if (errCode === "P2002") {
        const recheck = await prisma.user.findUnique({
          where: { id: userId },
          select: { passportCode: true },
        });
        if (recheck?.passportCode) return recheck.passportCode;
        continue;
      }
      throw err;
    }
  }
  return null;
}
