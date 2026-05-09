/**
 * Heimdall — shared enrichment of orchestrator output for the wire.
 *
 * Both /api/quiz/recommend (public) and /api/recs/games (API-key) need
 * the same downstream-friendly response shape: each game ID resolved
 * to a name + BGG metadata. This module owns that mapping so the two
 * routes don't drift.
 *
 * Server-to-server callers especially benefit — without enrichment,
 * a caller like HQ would have to hit BGG itself for every rec to get
 * a name. The metadata is already loaded server-side; passing it
 * through is free and removes a whole class of caller-side work.
 */

import gameMeta from './game-meta.json';
import type { RecommendedGame } from './orchestrator';

interface GameMetaEntry {
  name: string;
  year?: number | null;
  subdomain?: string | null;
  categories?: string[];
  description?: string | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
}

const META = gameMeta as Record<string, GameMetaEntry>;

export function getGameMeta(gameId: number): GameMetaEntry {
  return META[String(gameId)] ?? { name: `Game #${gameId}` };
}

/**
 * Build the wire shape for one rec — snake_case keys to match the
 * existing public /api/quiz/recommend contract. The shape is identical
 * for both public and API-key endpoints.
 */
export function enrichRec(r: RecommendedGame, idx: number) {
  const m = getGameMeta(r.gameId);
  return {
    game_id: r.gameId,
    game_name: m.name,
    year: m.year ?? null,
    subdomain: m.subdomain ?? null,
    categories: m.categories ?? [],
    description: m.description ?? null,
    min_players: m.minPlayers ?? null,
    max_players: m.maxPlayers ?? null,
    playing_time: m.playingTime ?? null,
    score: r.score,
    rank: idx + 1,
    contributions: r.contributions,
    top_dim_contributions: r.topDimContributions,
    all_dim_contributions: r.allDimContributions,
    explanation: r.explanation,
  };
}

export function enrichRecs(recs: RecommendedGame[]) {
  return recs.map(enrichRec);
}
