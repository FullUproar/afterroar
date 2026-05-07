// find-similar.mjs
// ============================================================================
// Pure function: find the games in a corpus most dimensionally similar to
// a given source game.
//
// This is the seed of a future "more like this" production feature: given
// a game the player loves, what other games in the corpus share its
// dimensional fingerprint?
//
// Distinct from match.mjs — which takes a PLAYER profile + game corpus.
// find-similar takes a GAME profile + game corpus, using game-game cosine
// similarity (the same metric MMR uses internally).
//
// Pure function. No I/O. Deterministic. Self-exclusion (the source game
// never appears in its own similar list).
// ============================================================================

import { gameGameSimilarity } from './match.mjs';

const DEFAULT_LIMIT = 10;

/**
 * Find the games in `gameProfiles` most similar to the source game.
 *
 * @param {number} sourceGameId
 *   The game_id of the source game. Must exist in gameProfiles.
 * @param {Array} gameProfiles
 *   Array of game profile objects. Each must have:
 *     - game_id: integer
 *     - dim_vector: { DIM_ID: number, ... }
 *     - confidence_per_dim: { DIM_ID: number, ... }  (optional)
 * @param {object} [options]
 *   - limit: int (default 10) — number of similar games to return
 *   - excludeGameIds: int[] (default []) — additional ids to skip
 * @returns {object}
 *   {
 *     source: { game_id, name?, dim_vector, ... },
 *     recommendations: [
 *       { game_id, cosine, profile },
 *       ...
 *     ]
 *   }
 *
 * Throws if sourceGameId not found in gameProfiles.
 */
export function findSimilarGames(sourceGameId, gameProfiles, options = {}) {
  if (!Number.isInteger(sourceGameId)) {
    throw new Error(`findSimilarGames: sourceGameId must be an integer, got ${typeof sourceGameId}`);
  }
  if (!Array.isArray(gameProfiles)) {
    throw new Error('findSimilarGames: gameProfiles must be an array');
  }

  const { limit = DEFAULT_LIMIT, excludeGameIds = [] } = options;
  const excludeSet = new Set([sourceGameId, ...excludeGameIds]);

  const source = gameProfiles.find(g => g.game_id === sourceGameId);
  if (!source) {
    throw new Error(`findSimilarGames: source game_id ${sourceGameId} not found in corpus`);
  }

  const ranked = gameProfiles
    .filter(g => g && g.game_id != null && !excludeSet.has(g.game_id))
    .map(g => ({
      game_id: g.game_id,
      cosine: gameGameSimilarity(source, g),
      profile: g,
    }))
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, limit);

  return { source, recommendations: ranked };
}

/**
 * Convenience: find the most similar game to each of several source games.
 * Useful for batch exploration.
 *
 * @param {number[]} sourceGameIds
 * @param {Array} gameProfiles
 * @param {object} [options]
 * @returns {Array<object>}  one result object per sourceGameId
 */
export function findSimilarBatch(sourceGameIds, gameProfiles, options = {}) {
  if (!Array.isArray(sourceGameIds)) {
    throw new Error('findSimilarBatch: sourceGameIds must be an array');
  }
  return sourceGameIds.map(id => findSimilarGames(id, gameProfiles, options));
}
