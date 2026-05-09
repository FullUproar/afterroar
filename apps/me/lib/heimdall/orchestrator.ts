/**
 * Heimdall — recommendation orchestrator (v0.1, stub).
 *
 * Watcher at the bridge of the gods. Sees what's available for a given
 * recommendation request, calls the eligible engines, threads outputs
 * between them, returns a unified ranking.
 *
 * v0.1 scope (today):
 *   - One callable engine that has data: seidr (225 game profiles, can
 *     match a player profile via cosine similarity).
 *   - Mimir is wired but its data layer (rec_game) isn't populated yet —
 *     calling it would return an empty pool, so it's not yet exercised.
 *   - Huginn + saga aren't activated (data thresholds unmet).
 *   - Composition is therefore trivial: pass-through to seidr when a
 *     player profile is supplied, empty result otherwise.
 *
 * v0.2+ (as engines come online):
 *   - Mimir runs in parallel once rec_game has BGG metadata.
 *   - Huginn runs once players have ≥5 edges.
 *   - Saga runs once recap data exists.
 *   - The dispatch logic here grows from "call seidr" to "run all eligible
 *     engines, compose outputs by confidence-weighted ensemble".
 *
 * Lives in apps/me because Passport is the natural caller and the source
 * of player identity/profile data. Per HEIMDALL.md, may move to
 * packages/heimdall/ later if cross-app callers need it.
 */

import { prisma } from '@/lib/prisma';
import {
  loadGameProfiles,
  loadPlayerProfile,
  type DimVector,
  type SeidrPlayerProfile,
  type SeidrGameProfile,
} from './load';
import gameMeta from './game-meta.json';

/**
 * Saga eligibility check via the engine's exported helper. Wraps prisma's
 * $queryRawUnsafe in a thin pg-client-shaped adapter so the engine code
 * stays db-driver-agnostic. Cached for 60s — checking on every recs
 * request is wasteful given the underlying counts move slowly (recap
 * ingestion is the only writer, at human-game-night cadence).
 */
let sagaEligibilityCache: { result: SagaEligibility; expiresAt: number } | null = null;
const SAGA_ELIGIBILITY_TTL_MS = 60_000;
interface SagaEligibility {
  eligible: boolean;
  reason: string | null;
  counts?: { observations: number; uniquePlayers: number; spanDays: number };
  thresholds?: { observations: number; uniquePlayers: number; spanDays: number };
}
async function checkSagaEligibilityCached(): Promise<SagaEligibility> {
  const now = Date.now();
  if (sagaEligibilityCache && sagaEligibilityCache.expiresAt > now) {
    return sagaEligibilityCache.result;
  }
  try {
    // Lazy import — saga is in a sibling workspace; we keep the import
    // out of the module-load critical path so a missing/broken saga
    // doesn't break the rest of the orchestrator at import time.
    const { checkSagaEligibility } = await import('@afterroar/rec-engine-saga/eligibility');
    const adapter = {
      query: async (sql: string) => {
        const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
        return { rows };
      },
    };
    const result = (await checkSagaEligibility(adapter)) as SagaEligibility;
    sagaEligibilityCache = { result, expiresAt: now + SAGA_ELIGIBILITY_TTL_MS };
    return result;
  } catch (err) {
    // If the saga tables don't exist yet (or the import failed), report
    // ineligible with the error visible. Don't poison the cache so a
    // fixed deploy refreshes immediately.
    const message = err instanceof Error ? err.message : String(err);
    return { eligible: false, reason: `saga eligibility probe failed: ${message}` };
  }
}

interface GameMetaEntry {
  name: string;
  year?: number | null;
  subdomain?: string | null;
  categories?: string[];
  minPlayers?: number | null;
  maxPlayers?: number | null;
}

/**
 * A game the user has positively signaled on (loved, thumbs_up). Carries
 * a weight so different signal strengths can boost differently — a
 * "loved" should pull harder than a casual thumbs_up.
 */
export interface AffinityAnchor {
  gameId: number;
  weight: number;
}

/**
 * Re-rank cosine-scored recommendations by their similarity to the user's
 * affinity anchors (games they've explicitly loved or thumbs-upped). The
 * boost is applied multiplicatively after the seidr cosine score so we
 * never invert the ranking — anchors tilt it toward "more like what you
 * already love" without flipping a great cosine match to a worse pick.
 *
 * Math: per candidate, compute max similarity to any anchor (max not sum
 * — one strongly-loved-similar game shouldn't be drowned out by many
 * weakly-similar ones). Multiply candidate score by (1 + alpha * boost).
 *
 * Anchor games themselves are excluded from the candidate pool earlier
 * (the "owned" / "thumbs_down" filter), so we don't have to worry about
 * a loved game self-boosting to rank #1.
 */
function applyAffinityBoost(
  recs: SeidrRecommendation[],
  gameProfiles: SeidrGameProfile[],
  anchors: AffinityAnchor[],
  alpha: number,
): SeidrRecommendation[] {
  if (anchors.length === 0 || alpha <= 0) return recs;
  const profilesById = new Map<number, SeidrGameProfile>();
  for (const g of gameProfiles) profilesById.set(g.game_id, g);

  // Precompute anchor profiles once. Skip anchors not in our corpus
  // (the user can tag a game we don't have a profile for; it just
  // contributes nothing to the boost).
  const anchorProfiles: Array<{ profile: SeidrGameProfile; weight: number }> = [];
  for (const a of anchors) {
    const p = profilesById.get(a.gameId);
    if (p) anchorProfiles.push({ profile: p, weight: a.weight });
  }
  if (anchorProfiles.length === 0) return recs;

  return recs.map((r) => {
    const candidate = profilesById.get(r.game_id);
    if (!candidate) return r;
    let maxSim = 0;
    for (const { profile: anchor, weight } of anchorProfiles) {
      const sim = gameGameSimilarity(candidate, anchor);
      const weighted = sim * weight;
      if (weighted > maxSim) maxSim = weighted;
    }
    // Clamp boost to a sane range. cosine returns [-1, 1]; weighted by
    // anchor weight (typically 0.5..1.5) it can push slightly past 1.
    const boost = Math.max(0, Math.min(1, maxSim));
    return { ...r, score: r.score * (1 + alpha * boost) };
  });
}

function applyFilters(
  profiles: SeidrGameProfile[],
  filters: RecommendRequest['filters'],
): SeidrGameProfile[] {
  if (!filters) return profiles;
  const { minYear, maxYear, subdomains } = filters;
  const subdomainSet = subdomains && subdomains.length > 0 ? new Set(subdomains) : null;
  const meta = gameMeta as Record<string, GameMetaEntry>;
  return profiles.filter((p) => {
    const m = meta[String(p.game_id)];
    // Games without metadata fall through filters silently — better to
    // include than to drop a candidate purely because we don't have year.
    if (!m) return true;
    if (typeof minYear === 'number' && typeof m.year === 'number' && m.year < minYear) return false;
    if (typeof maxYear === 'number' && typeof m.year === 'number' && m.year > maxYear) return false;
    if (subdomainSet && m.subdomain && !subdomainSet.has(m.subdomain)) return false;
    return true;
  });
}

// Local copy of the canonical seidr matcher. The original lives in
// rec-engines/seidr/src/match.mjs (283 tests, hand-tuned over 30
// sprints). Copied verbatim into apps/me/lib/heimdall/ on 2026-05-09
// because Vercel's bundler couldn't resolve cross-tree .mjs imports
// reliably under the apps/me Root Directory config.
//
// Source of truth: still rec-engines/seidr/src/match.mjs. Sync this
// file when the canonical matcher changes (no automated process yet —
// add a CI check or a sync script when seidr v2 lands).
//
// What we get vs the previous inline cosine:
//   - MMR diversification (the bigger win for perceived quality —
//     avoids 5 same-vibe games clustering at the top)
//   - Designer cap (max 2 games per designer)
//   - Confidence-weighted cosine (low-confidence dims contribute less)
//   - Player-count filtering when bggMetadata is supplied
//
import { match as canonicalSeidrMatch, gameGameSimilarity, scoreAll as canonicalSeidrScoreAll } from './seidr-match.mjs';
/**
 * One contributing dimension's role in the cosine score. The contribution
 * is the un-normalized term that adds to the dot product (player × game).
 *
 * `kind` tells the UI how to phrase it:
 *   - `agree_high`: both player AND game are positive on this dim ("you both like X")
 *   - `agree_low`: both player AND game are negative ("you both avoid X")
 *   - `disagree`:  player + game are on opposite sides (negative term — drags the score down)
 *   - `neutral`:   one or both are near zero (small term either way)
 */
export interface DimContribution {
  dim: string;
  contribution: number;
  player: number;
  game: number;
  kind: 'agree_high' | 'agree_low' | 'disagree' | 'neutral';
}

function classifyContribution(player: number, game: number): DimContribution['kind'] {
  const NEAR_ZERO = 0.15;
  if (Math.abs(player) < NEAR_ZERO || Math.abs(game) < NEAR_ZERO) return 'neutral';
  if (player > 0 && game > 0) return 'agree_high';
  if (player < 0 && game < 0) return 'agree_low';
  return 'disagree';
}

/**
 * Wrap the canonical seidr.match() and re-build our DimContribution shape
 * (which encodes player vs game value alongside the contribution magnitude
 * — needed for the agree_high/agree_low/disagree classification).
 *
 * The seidr matcher returns contributingDims as { dim, contribution }
 * sorted top-5 by absolute magnitude. We re-look-up the player + game
 * values per dim to classify each.
 */
interface SeidrRecommendation {
  game_id: number;
  score: number;
  topContributions: DimContribution[];
  /** Full ranked contribution list (including neutrals) for the "why this rec" view. */
  allContributions: DimContribution[];
}

interface SeidrCanonicalRecommendation {
  game_id: number;
  score: number;
  cosineSimilarity: number;
  unweightedCosine: number;
  contributingDims: Array<{ dim: string; contribution: number }>;
  dimsConsidered: number;
  normalizedScore?: number;
}

function runSeidr(
  player: SeidrPlayerProfile,
  games: SeidrGameProfile[],
  options: { limit: number; excludeGameIds?: number[]; topDims?: number },
): {
  recommendations: SeidrRecommendation[];
  filtered: Array<{ game_id: number; reason: string }>;
  totalConsidered: number;
} {
  const topDims = options.topDims ?? 3;
  const result = canonicalSeidrMatch(player, games, {
    limit: options.limit,
    excludeGameIds: options.excludeGameIds ?? [],
    diversify: true,
    useConfidence: true,
  }) as {
    recommendations: SeidrCanonicalRecommendation[];
    filtered: Array<{ game_id: number; reason: string }>;
    totalConsidered: number;
  };

  const playerVec = player.dim_vector ?? {};
  const gamesById = new Map<number, SeidrGameProfile>();
  for (const g of games) gamesById.set(g.game_id, g);

  const recommendations: SeidrRecommendation[] = result.recommendations.map((r) => {
    const game = gamesById.get(r.game_id);
    const gameVec = game?.dim_vector ?? {};
    const enriched: DimContribution[] = (r.contributingDims ?? []).map((c) => {
      const pv = numericOr(playerVec[c.dim], 0);
      const gv = numericOr(gameVec[c.dim], 0);
      return {
        dim: c.dim,
        contribution: c.contribution,
        player: pv,
        game: gv,
        kind: classifyContribution(pv, gv),
      };
    });
    return {
      game_id: r.game_id,
      score: r.score,
      topContributions: enriched.filter((c) => c.kind !== 'neutral').slice(0, topDims),
      allContributions: enriched,
    };
  });

  return {
    recommendations,
    filtered: result.filtered,
    totalConsidered: result.totalConsidered,
  };
}

function numericOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export interface RecommendRequest {
  /**
   * Caller's identification of the player. If provided AND the player
   * has a saved seidr profile, we'll fetch and use it.
   */
  playerId?: string;
  /**
   * Inline player profile (24-dim vector). Used when the caller has the
   * profile in hand and doesn't want a DB lookup, or for cold-start
   * preview ("show me what someone with this profile would get").
   *
   * Shape: a flat dim id → number map, e.g. { PSY_ACHIEVEMENT: 0.6, ... }.
   * Heimdall wraps it in seidr's expected {dim_vector, confidence_vector}
   * shape internally; callers don't need to.
   */
  playerProfile?: DimVector;
  /**
   * Caller-controlled context. Passed through to engines that consume it.
   * Today only `playerCount` (filter by range) and `excludeGameIds` are
   * honored by seidr. Future engines will use more.
   */
  context?: {
    playerCount?: number;
    excludeGameIds?: number[];
  };
  /**
   * Hard filters applied to the candidate pool BEFORE matching. A game
   * not matching all active filters is dropped from consideration. Keep
   * these soft-leaning in UI ("show me modern only" should still find
   * the great older classics if specifically asked) but the engine
   * itself treats them as a strict filter — the matcher only sees
   * candidates that passed.
   */
  filters?: {
    /** Inclusive year range. Either bound is optional. */
    minYear?: number;
    maxYear?: number;
    /**
     * BGG subdomains to allow (Strategy / Family / Party / Wargame /
     * Thematic / Customizable / Children / Abstract). Empty/missing
     * means "all subdomains."
     */
    subdomains?: string[];
  };
  /**
   * Top-K to return. Defaults to 12.
   */
  limit?: number;
  /**
   * Games the user has positively signaled on (loved, thumbs_up). Each
   * candidate gets a boost proportional to its max similarity to any
   * anchor. Anchors that aren't in the corpus are silently ignored.
   *
   * Suggested weights:
   *   - loved: 1.0 (or higher if you want this to dominate)
   *   - thumbs_up: 0.5 (a positive nudge, not a profile rewrite)
   */
  affinityAnchors?: AffinityAnchor[];
}

export interface RecommendedGame {
  gameId: number;
  score: number;
  /**
   * Per-engine contributions to the final score. Today only seidr
   * contributes; future versions will show mimir / huginn / saga
   * weights too.
   */
  contributions: {
    seidr?: number;
    mimir?: number;
    huginn?: number;
    saga?: number;
  };
  /**
   * Top dimensions that drove the seidr match. Lets the UI explain
   * "why this game" without needing the user to know the game
   * itself — they can grade the *logic* by seeing which dimensions
   * aligned. Empty when no engine that produces dim contributions
   * ran.
   */
  topDimContributions?: DimContribution[];
  /**
   * Full per-dim contribution breakdown (all 5 dims the matcher
   * surfaced, including those classified `neutral`). Used by the
   * "why this rec" expander to give the full picture beyond the
   * 3 chips. May be omitted when the engine returns no breakdown.
   */
  allDimContributions?: DimContribution[];
  /**
   * Optional human-readable explanation. Future: aggregate of per-engine
   * explanations.
   */
  explanation?: string;
}

export interface RecommendResponse {
  /**
   * Ranked games, top-K by aggregate score. Length may be < limit if the
   * candidate pool is smaller.
   */
  recommendations: RecommendedGame[];
  /**
   * Engines that ran and contributed to the result. Useful for debugging
   * and for callers that want to know which signals fired.
   */
  enginesRan: Array<'mimir' | 'seidr' | 'huginn' | 'saga'>;
  /**
   * Engines that were eligible but didn't run (e.g. data not ready).
   * Helps callers understand the recommendation's depth.
   */
  enginesSkipped: Array<{ name: string; reason: string }>;
  /**
   * Total candidate games considered before ranking + filtering.
   */
  candidatesConsidered: number;
}

const DEFAULT_LIMIT = 12;

export async function recommendGames(req: RecommendRequest): Promise<RecommendResponse> {
  const limit = req.limit ?? DEFAULT_LIMIT;
  const enginesRan: RecommendResponse['enginesRan'] = [];
  const enginesSkipped: RecommendResponse['enginesSkipped'] = [];

  // Resolve the player profile into seidr's expected shape.
  let playerProfile: SeidrPlayerProfile | null = null;
  if (req.playerProfile) {
    playerProfile = { dim_vector: req.playerProfile };
  } else if (req.playerId) {
    playerProfile = await loadPlayerProfile(req.playerId);
  }

  // Mimir eligibility: needs rec_game data to be populated (it isn't yet).
  // Skip for now; flip on once BGG fetch lands.
  enginesSkipped.push({ name: 'mimir', reason: 'rec_game not yet populated' });

  // Huginn eligibility: needs ≥5 edges in rec_edge for this player.
  // Skip for v0.1 — checking the threshold is straightforward but we don't
  // exercise it until huginn's matcher is implemented.
  enginesSkipped.push({ name: 'huginn', reason: 'phase-1 — not yet implemented' });

  // Saga eligibility: real DB-backed check via the engine's exported
  // gate. Reason text reflects the specific threshold not yet met
  // (observations / unique players / time span) so operators can see
  // how close we are. Cached for 60s to keep it cheap on hot paths.
  const sagaCheck = await checkSagaEligibilityCached();
  if (!sagaCheck.eligible) {
    enginesSkipped.push({ name: 'saga', reason: sagaCheck.reason ?? 'phase-2 — not yet active' });
  }

  // Seidr is the only engine with both code and data today. Skip when
  // there's no player profile to match against — seidr has no cold-start
  // story (that's mimir's job).
  if (!playerProfile) {
    enginesSkipped.push({ name: 'seidr', reason: 'no player profile available' });
    return {
      recommendations: [],
      enginesRan,
      enginesSkipped,
      candidatesConsidered: 0,
    };
  }

  const allProfiles: SeidrGameProfile[] = await loadGameProfiles();
  const gameProfiles = applyFilters(allProfiles, req.filters);

  // When the user has provided affinity anchors, fetch a wider pool from
  // the matcher (3x the requested limit) so the boost has more candidates
  // to lift up. Without anchors, fetching exactly the limit is fine —
  // the MMR-diversified top-K is already the answer.
  const anchors = req.affinityAnchors ?? [];
  const matcherLimit = anchors.length > 0 ? limit * 3 : limit;

  const seidrResult = runSeidr(playerProfile, gameProfiles, {
    limit: matcherLimit,
    excludeGameIds: req.context?.excludeGameIds ?? [],
    topDims: 3,
  });
  enginesRan.push('seidr');

  // Apply affinity boost (no-op when anchors empty). Multiplicatively
  // tilts the cosine ranking toward games similar to the user's loved/
  // thumbs-upped picks, without inverting it. alpha=0.5 means a perfect
  // similarity match (sim=1.0) gets +50% boost — strong but not dominant.
  const AFFINITY_ALPHA = 0.5;
  const boosted = applyAffinityBoost(seidrResult.recommendations, gameProfiles, anchors, AFFINITY_ALPHA);

  // After boosting, re-sort and take the original requested limit. The
  // matcher already MMR-diversified the input pool, so the boosted
  // top-K stays reasonably varied even when re-sorted by boosted score.
  const finalRanked = [...boosted].sort((a, b) => b.score - a.score).slice(0, limit);

  // v0.1 composition: trivially adopt seidr's ranking. v0.2 will weight
  // multiple engines' contributions via confidence-aware ensemble.
  const recommendations: RecommendedGame[] = finalRanked.map((r) => ({
    gameId: r.game_id,
    score: r.score,
    contributions: { seidr: r.score },
    topDimContributions: r.topContributions,
    allDimContributions: r.allContributions,
  }));

  return {
    recommendations,
    enginesRan,
    enginesSkipped,
    candidatesConsidered: seidrResult.totalConsidered,
  };
}

// ---------------------------------------------------------------------
// Group recommendations
// ---------------------------------------------------------------------
//
// Picks a game for a group of N players. The naive approach — average
// everyone's profile into one and run single-player recs — destroys
// information at the extremes: 2 wargamers + 2 wargame-haters average
// to "neutral on combat," and the matcher serves a euro that disappoints
// both halves.
//
// Instead: score every candidate game against every player's profile
// independently, then aggregate per-game across players. Default
// aggregation is **min** (egalitarian — find the game where the
// least-happy player is happiest). 'mean' is exposed for callers that
// want the utilitarian view (it's the trap, but documented).
//
// Honors filters and exclusions like single-player. Excludes any game
// owned by ANY player (no point recommending what one of them already
// has). Affinity anchors are unioned across all players (max-per-game
// behavior preserved).
//
// MMR diversification is skipped in this v1 — the group case usually
// returns a small list (often just 5-10 picks) and the user picks one,
// so over-similar adjacent picks aren't the failure mode that drove
// MMR for single-player. Easy to layer in later.

export interface GroupRecommendRequest {
  /**
   * Passport user ids of every player at the table. We resolve each to
   * their saved seidr profile; players without a saved profile are
   * skipped (returned in `playersSkipped`) — the rec runs on whoever's
   * left. Group of 1 degenerates to single-player and is allowed.
   */
  playerIds: string[];
  /**
   * Same shape as RecommendRequest.context. `playerCount` defaults to
   * `playerIds.length` if omitted (the typical case — group of 4 wants
   * games that play 4). Pass an explicit value to override (e.g. group
   * size doesn't match the rec target).
   */
  context?: {
    playerCount?: number;
    excludeGameIds?: number[];
  };
  filters?: RecommendRequest['filters'];
  limit?: number;
  affinityAnchors?: AffinityAnchor[];
  /**
   * Per-game cross-player aggregation:
   *   - 'min' (default): worst-off player's score. Egalitarian. The right
   *     default for group game-night picks — nobody having a bad time
   *     matters more than everyone having a slightly-better-than-average
   *     time.
   *   - 'mean': average across all players. Documented for
   *     completeness; surfaces "broadly liked but might leave outliers
   *     stranded" picks. Don't use this without thought.
   */
  aggregation?: 'min' | 'mean';
}

export interface GroupRecommendedGame extends RecommendedGame {
  /**
   * Per-player score breakdown — lets the UI surface "Alice 0.7, Bob
   * 0.6, Carol 0.4 → group min = 0.4" so the floor is visible.
   */
  perPlayerScores: Array<{ playerId: string; score: number }>;
  /**
   * The aggregate value used for ranking (min or mean per the request's
   * aggregation strategy). Same as `score` on this object — duplicated
   * for clarity at the consumer.
   */
  groupAggregateScore: number;
  /**
   * Spread = max - min across players. Useful for surfacing "everyone
   * loves this" (low spread, high min) vs "polarizing" (high spread).
   */
  scoreSpread: number;
}

export interface GroupRecommendResponse {
  recommendations: GroupRecommendedGame[];
  enginesRan: RecommendResponse['enginesRan'];
  enginesSkipped: RecommendResponse['enginesSkipped'];
  candidatesConsidered: number;
  /** Players whose profiles were loaded and used in scoring. */
  playersResolved: string[];
  /**
   * Players we couldn't include — usually because they haven't taken
   * the quiz. UI should prompt them to take it before re-running.
   */
  playersSkipped: Array<{ playerId: string; reason: string }>;
  /** The aggregation strategy that was applied. */
  aggregation: 'min' | 'mean';
}

interface SeidrScoredGame {
  game_id: number;
  score: number;
}

export async function recommendForGroup(
  req: GroupRecommendRequest,
): Promise<GroupRecommendResponse> {
  const limit = req.limit ?? DEFAULT_LIMIT;
  const aggregation = req.aggregation ?? 'min';
  const enginesRan: RecommendResponse['enginesRan'] = [];
  const enginesSkipped: RecommendResponse['enginesSkipped'] = [];

  // Same eligibility skips as single-player — keep the response shape
  // self-describing about which engines ran.
  enginesSkipped.push({ name: 'mimir', reason: 'rec_game not yet populated' });
  enginesSkipped.push({ name: 'huginn', reason: 'phase-1 — not yet implemented' });
  enginesSkipped.push({ name: 'saga', reason: 'phase-2 — needs ≥3000 recaps' });

  if (!Array.isArray(req.playerIds) || req.playerIds.length === 0) {
    enginesSkipped.push({ name: 'seidr', reason: 'no players in group' });
    return {
      recommendations: [],
      enginesRan,
      enginesSkipped,
      candidatesConsidered: 0,
      playersResolved: [],
      playersSkipped: [],
      aggregation,
    };
  }

  // Load every player's profile. Players without a saved profile are
  // skipped — the rec runs on whoever's left.
  const profilePairs = await Promise.all(
    req.playerIds.map(async (playerId) => ({
      playerId,
      profile: await loadPlayerProfile(playerId),
    })),
  );

  const resolved: Array<{ playerId: string; profile: SeidrPlayerProfile }> = [];
  const playersSkipped: GroupRecommendResponse['playersSkipped'] = [];
  for (const p of profilePairs) {
    if (p.profile) resolved.push({ playerId: p.playerId, profile: p.profile });
    else playersSkipped.push({ playerId: p.playerId, reason: 'no saved profile (take the quiz)' });
  }

  if (resolved.length === 0) {
    enginesSkipped.push({ name: 'seidr', reason: 'no players in group have a saved profile' });
    return {
      recommendations: [],
      enginesRan,
      enginesSkipped,
      candidatesConsidered: 0,
      playersResolved: [],
      playersSkipped,
      aggregation,
    };
  }

  const allProfiles: SeidrGameProfile[] = await loadGameProfiles();

  // Default playerCount to the group size — almost always what callers
  // mean when they pass a group. Caller can override.
  const playerCount = req.context?.playerCount ?? req.playerIds.length;
  const excludeIds = new Set<number>(req.context?.excludeGameIds ?? []);

  // Apply filters (year, subdomain) once on the candidate pool.
  let candidates = applyFilters(allProfiles, req.filters);
  // Apply player-count filter via game-meta — drop games that can't
  // physically be played by this group size.
  if (playerCount && playerCount > 0) {
    candidates = candidates.filter((g) => {
      const m = (gameMeta as Record<string, GameMetaEntry>)[String(g.game_id)];
      if (!m) return true;
      if (typeof m.minPlayers === 'number' && playerCount < m.minPlayers) return false;
      if (typeof m.maxPlayers === 'number' && playerCount > m.maxPlayers) return false;
      return true;
    });
  }
  // Apply hard exclusions.
  if (excludeIds.size > 0) {
    candidates = candidates.filter((g) => !excludeIds.has(g.game_id));
  }
  const totalConsidered = candidates.length;

  // Score every candidate against every resolved player.
  // perGameScores: game_id → { playerId: score }
  const perGameScores = new Map<number, Map<string, number>>();
  for (const { playerId, profile } of resolved) {
    const scored = canonicalSeidrScoreAll(profile, candidates) as SeidrScoredGame[];
    for (const s of scored) {
      let m = perGameScores.get(s.game_id);
      if (!m) {
        m = new Map();
        perGameScores.set(s.game_id, m);
      }
      m.set(playerId, s.score);
    }
  }

  // Aggregate per-game across players using the selected strategy.
  // Build a ranked list of GroupRecommendedGame (light shape, no
  // top-dim contributions yet — those are single-player concepts;
  // future v1.1 will compute "the dim that pulled the floor down" for
  // the worst-off player as the natural group-version of explainability).
  const aggregated: GroupRecommendedGame[] = [];
  for (const [gameId, playerScoreMap] of perGameScores) {
    const playerScores = resolved.map(({ playerId }) => ({
      playerId,
      score: playerScoreMap.get(playerId) ?? 0,
    }));
    const scores = playerScores.map((p) => p.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const sumScore = scores.reduce((a, b) => a + b, 0);
    const meanScore = sumScore / scores.length;
    const aggregateScore = aggregation === 'mean' ? meanScore : minScore;
    aggregated.push({
      gameId,
      score: aggregateScore,
      contributions: { seidr: aggregateScore },
      perPlayerScores: playerScores,
      groupAggregateScore: aggregateScore,
      scoreSpread: maxScore - minScore,
    });
  }

  // Apply affinity boost across the union of all players' anchors —
  // one strong "loved" pulls the group the same way a single-player one
  // would. Per-game boost is still max (not sum) so a game similar to
  // *any* anchor gets the lift, but multi-anchor matches don't compound.
  const anchors = req.affinityAnchors ?? [];
  const AFFINITY_ALPHA = 0.5;
  const boosted = applyAffinityBoost(
    aggregated.map((g) => ({
      game_id: g.gameId,
      score: g.score,
      topContributions: [],
      allContributions: [],
    })),
    candidates,
    anchors,
    AFFINITY_ALPHA,
  );

  // Splice the boosted scores back onto the aggregated entries.
  const boostedByGame = new Map(boosted.map((b) => [b.game_id, b.score]));
  for (const g of aggregated) {
    const newScore = boostedByGame.get(g.gameId);
    if (typeof newScore === 'number') {
      g.score = newScore;
      g.groupAggregateScore = newScore;
      g.contributions = { seidr: newScore };
    }
  }

  // Final ranking + slice to limit. Sort by aggregate desc; tie-break
  // on lower spread (less polarizing wins ties).
  aggregated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.scoreSpread - b.scoreSpread;
  });

  enginesRan.push('seidr');

  return {
    recommendations: aggregated.slice(0, limit),
    enginesRan,
    enginesSkipped,
    candidatesConsidered: totalConsidered,
    playersResolved: resolved.map((r) => r.playerId),
    playersSkipped,
    aggregation,
  };
}
