/**
 * Heimdall — DB loaders for the rec_seidr_* tables.
 *
 * The rec_* tables aren't in apps/me's Prisma schema (they're managed by
 * the rec-engines own raw-SQL migrations under SILO discipline). We
 * access them via $queryRaw on the existing Prisma client so we don't
 * need a separate pg pool — Prisma's connection pool already serves us.
 *
 * Heimdall consumes these readonly. Writes live in the engines' own
 * scripts and migrations; nothing in apps/me writes to rec_* today.
 */

import { prisma } from '@/lib/prisma';

/**
 * 24-dim feature vector. Sparse map keyed by dim id (e.g. 'PSY_ACHIEVEMENT').
 * Public callers pass + receive this shape; the wrapper adapter below
 * converts to the {dim_vector, confidence_vector} shape seidr.match expects.
 */
export type DimVector = Record<string, number>;

/**
 * What seidr.match() expects for the player.
 */
export interface SeidrPlayerProfile {
  dim_vector: DimVector;
  confidence_vector?: DimVector;
}

/**
 * What seidr.match() expects for each game.
 */
export interface SeidrGameProfile {
  game_id: number;
  dim_vector: DimVector;
  confidence_per_dim?: DimVector;
}

let cachedGameProfiles: { profiles: SeidrGameProfile[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all active (not-superseded) seidr game profiles. Cached in
 * memory for 5 minutes — the corpus is hand-authored seed data that
 * doesn't change frequently. v0.2 might invalidate via webhook when
 * profiles are regenerated.
 */
export async function loadGameProfiles(): Promise<SeidrGameProfile[]> {
  if (cachedGameProfiles && Date.now() - cachedGameProfiles.loadedAt < CACHE_TTL_MS) {
    return cachedGameProfiles.profiles;
  }
  const rows = await prisma.$queryRaw<
    Array<{ game_id: bigint; dim_vector: DimVector; confidence_per_dim: DimVector | null }>
  >`
    SELECT game_id, dim_vector, confidence_per_dim
    FROM rec_seidr_game_profile
    WHERE NOT superseded
  `;
  const profiles: SeidrGameProfile[] = rows.map((r) => ({
    // bigint → number for downstream code (BGG IDs are well within JS safe integer range)
    game_id: Number(r.game_id),
    dim_vector: r.dim_vector,
    confidence_per_dim: r.confidence_per_dim ?? undefined,
  }));
  cachedGameProfiles = { profiles, loadedAt: Date.now() };
  return profiles;
}

/**
 * Look up a player's most recent seidr profile by their Passport user id.
 * Returns null when the player hasn't taken (or saved) the quiz yet.
 *
 * rec_seidr_player_profile.player_id stores the Passport user id directly
 * (the planned indirection through rec_player was never built — passport_id
 * is the natural key for player profiles in the seidr engine). Picks the
 * highest profile_version (latest retake) by completed_at as tiebreaker.
 */
export async function loadPlayerProfile(passportId: string): Promise<SeidrPlayerProfile | null> {
  const rows = await prisma.$queryRaw<
    Array<{ dim_vector: DimVector; confidence_vector: DimVector }>
  >`
    SELECT dim_vector, confidence_vector
    FROM rec_seidr_player_profile
    WHERE player_id = ${passportId}
    ORDER BY profile_version DESC, completed_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return {
    dim_vector: rows[0].dim_vector,
    confidence_vector: rows[0].confidence_vector,
  };
}

/**
 * Test/admin convenience — invalidate the in-memory game-profile cache.
 * Heimdall doesn't expose this externally; useful from internal scripts.
 */
export function clearGameProfileCache(): void {
  cachedGameProfiles = null;
}
