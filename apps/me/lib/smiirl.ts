/**
 * Smiirl push helper — pushes the verified Passport user count to a
 * Smiirl Custom Counter device using the PUSH NUMBER mode.
 *
 * Per Smiirl's docs (https://github.com/smiirl/smiirl-custom-samples):
 *   GET http://api.smiirl.com/{MAC}/set-number/{TOKEN}/{N}
 *
 * The device must be configured for PUSH mode in https://my.smiirl.com.
 * If the device is in JSON URL mode, this push has no effect — Smiirl
 * ignores set-number calls in poll mode.
 *
 * Env vars expected:
 *   SMIIRL_DEVICE_MAC   — 12-char hex device id (no colons)
 *   SMIIRL_AUTH_TOKEN   — 32-char hex token from the device's admin page
 */

import { prisma } from "@/lib/prisma";

const SMIIRL_API = "http://api.smiirl.com";

interface PushResult {
  ok: boolean;
  realCount: number;
  pushedValue: number;
  error?: string;
  deviceResponseStatus?: number;
}

export async function pushVerifiedCountToSmiirl(): Promise<PushResult> {
  const mac = process.env.SMIIRL_DEVICE_MAC;
  const token = process.env.SMIIRL_AUTH_TOKEN;
  if (!mac || !token) {
    return {
      ok: false,
      realCount: 0,
      pushedValue: 0,
      error: "SMIIRL_DEVICE_MAC and SMIIRL_AUTH_TOKEN must be set",
    };
  }

  const realCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  const url = `${SMIIRL_API}/${mac}/set-number/${token}/${realCount}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        realCount,
        pushedValue: realCount,
        deviceResponseStatus: res.status,
        error: `Smiirl returned ${res.status}`,
      };
    }
    return { ok: true, realCount, pushedValue: realCount, deviceResponseStatus: res.status };
  } catch (err) {
    return {
      ok: false,
      realCount,
      pushedValue: realCount,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
