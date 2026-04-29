/**
 * Generate / parse PosEventTicket serials.
 *
 * Format: `TKT-XXXX-XXXX` (12 chars + 2 dashes). 8 character body drawn from
 * a no-confusion alphabet (no 0/O, no 1/I) so customers can type the code
 * from a printed receipt without ambiguity. The dashes are cosmetic only —
 * the redeem endpoint accepts either form.
 *
 * Collision space: 32^8 ≈ 1 trillion. We retry on collision (rare). Birthday-
 * paradox starts to matter around 1 million sold tickets, at which point we'd
 * cycle to a longer body or per-event-prefixed serials. For now, fine.
 */

import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "TKT-";

export function generateTicketSerial(): string {
  const buf = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return `${PREFIX}${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Strip dashes + uppercase. Lets us accept "TKT-ABCD-EFGH" or "TKTABCDEFGH". */
export function normalizeTicketSerial(input: string): string {
  const cleaned = input.trim().replace(/-/g, "").toUpperCase();
  if (!cleaned.startsWith("TKT")) return cleaned;
  const body = cleaned.slice(3);
  if (body.length !== 8) return cleaned;
  return `${PREFIX}${body.slice(0, 4)}-${body.slice(4)}`;
}
