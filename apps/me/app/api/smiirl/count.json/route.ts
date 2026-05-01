import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/smiirl/count.json
 *
 * Public endpoint polled by the Smiirl Custom Counter device in JSON URL
 * mode. Smiirl hits this URL every few seconds and reads the `number`
 * field. No auth — Smiirl's polling agent is anonymous and we want it
 * that way. The number is just a count; not sensitive.
 *
 * Configuration: set the device's URL to
 *   https://www.afterroar.me/api/smiirl/count.json
 * in my.smiirl.com under the device's settings.
 *
 * We previously used PUSH mode (calling Smiirl from our backend on each
 * verified-user event). Push mode collided with manual sets done via
 * Smiirl's own admin UI; the device would oscillate between our pushed
 * value and whatever someone last typed in the Smiirl UI. Poll mode
 * makes us the single source of truth — Smiirl reads, never accepts a
 * write from anywhere but the device admin (and the device admin loses
 * to the next poll).
 *
 * Cache headers are deliberately short. Smiirl polls every ~5s; we
 * want any new signup to be reflected within one poll cycle, not held
 * for minutes by a CDN cache.
 */
export async function GET() {
  const verifiedCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  return NextResponse.json(
    { number: verifiedCount },
    {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, must-revalidate',
        // Smiirl docs recommend explicit Content-Type; default is fine but
        // belt-and-suspenders.
        'Content-Type': 'application/json',
      },
    },
  );
}
