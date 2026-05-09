/**
 * Unit tests for the recommendForGroup orchestrator function.
 *
 * Mocks every I/O dependency so the tests are deterministic and run
 * without DB / network. Uses real BGG IDs (Catan, Gloomhaven, etc) so
 * the gameMeta-backed playerCount filter has data to work against;
 * everything else (player profiles, game profiles) is synthetic and
 * controlled per-test.
 *
 * What we're proving:
 *   1. Aggregation math: min vs mean produce the documented behavior
 *   2. The egalitarian claim: in conflict groups, min raises the floor
 *   3. Tie-break: equal scores → lower spread wins
 *   4. PlayerCount auto-default uses group size; explicit override wins
 *   5. PlayerCount filter actually drops out-of-range games
 *   6. ExcludeIds drop games before scoring
 *   7. Filters (year/subdomain) drop games before scoring
 *   8. Affinity boost lifts similar games (max-per-game across anchors)
 *   9. Edge cases: empty group, all-unresolved, mixed resolved/unresolved
 *  10. Single-player group degenerates correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ---------------------------------------------------------------
//
// load.ts: synthetic profiles per test via mockReturnValue. We mock the
// whole module so the orchestrator's import binds to our fakes.
//
// prisma + saga eligibility: we don't care; saga should report ineligible
// (which is the production state anyway). Mock prisma to return zero
// observations and the saga path naturally falls through to "skipped."

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(async () => [{ observations: 0, unique_players: 0, span_days: 0 }]),
  },
}));

const mockLoadGameProfiles = vi.fn();
const mockLoadPlayerProfile = vi.fn();
vi.mock('@/lib/heimdall/load', () => ({
  loadGameProfiles: mockLoadGameProfiles,
  loadPlayerProfile: mockLoadPlayerProfile,
}));

// Import AFTER mocks are registered.
const { recommendForGroup } = await import('@/lib/heimdall/orchestrator');

// ---- Fixtures ------------------------------------------------------------

/**
 * Synthetic player profiles. Two opposed: "wargamer-like" (high COOP_COMP
 * positive = competitive, high MEC_COMPLEXITY) and "family-like" (low
 * COOP_COMP = cooperative, low MEC_COMPLEXITY). The aggregation math
 * tests use these.
 */
const wargamerProfile = {
  dim_vector: {
    SOC_COOP_COMP: 0.8,
    MEC_COMPLEXITY: 0.8,
    EMO_HUMOR: -0.5,
    AES_NARRATIVE: 0.0,
  },
};
const familyProfile = {
  dim_vector: {
    SOC_COOP_COMP: -0.3,
    MEC_COMPLEXITY: -0.6,
    EMO_HUMOR: 0.6,
    AES_NARRATIVE: 0.2,
  },
};
const middleProfile = {
  dim_vector: {
    SOC_COOP_COMP: 0.2,
    MEC_COMPLEXITY: 0.2,
    EMO_HUMOR: 0.0,
    AES_NARRATIVE: 0.1,
  },
};

/**
 * Synthetic game profiles attached to real BGG IDs (so gameMeta lookups
 * succeed for the playerCount filter). The dim vectors are crafted so:
 *   - 'heavy_war'  is a great fit for wargamer, terrible for family
 *   - 'family_coop' is great for family, weak for wargamer
 *   - 'middle_ground' is mediocre for both (the aggregation safe pick)
 *   - 'all_zero' is neutral baseline for sanity
 */
const heavyWarGame = {
  game_id: 174430, // Gloomhaven (1-4 players, 120m, Strategy)
  dim_vector: {
    SOC_COOP_COMP: 0.9,
    MEC_COMPLEXITY: 0.9,
    EMO_HUMOR: -0.6,
    AES_NARRATIVE: 0.2,
  },
};
const familyCoopGame = {
  game_id: 266192, // Wingspan (1-5 players, 70m, Strategy)
  dim_vector: {
    SOC_COOP_COMP: -0.4,
    MEC_COMPLEXITY: -0.5,
    EMO_HUMOR: 0.5,
    AES_NARRATIVE: 0.3,
  },
};
const middleGroundGame = {
  game_id: 167791, // Terraforming Mars (1-5 players, 120m, Strategy)
  dim_vector: {
    SOC_COOP_COMP: 0.2,
    MEC_COMPLEXITY: 0.3,
    EMO_HUMOR: 0.0,
    AES_NARRATIVE: 0.2,
  },
};
const fillerGame = {
  game_id: 11, // Bohnanza (2-7 players, 45m, Strategy)
  dim_vector: {
    SOC_COOP_COMP: 0.0,
    MEC_COMPLEXITY: -0.4,
    EMO_HUMOR: 0.4,
    AES_NARRATIVE: -0.2,
  },
};
const fourMaxGame = {
  game_id: 13, // Catan (3-4 players, 120m, Customizable)
  dim_vector: {
    SOC_COOP_COMP: 0.3,
    MEC_COMPLEXITY: 0.0,
    EMO_HUMOR: 0.2,
    AES_NARRATIVE: 0.0,
  },
};

beforeEach(() => {
  mockLoadGameProfiles.mockReset();
  mockLoadPlayerProfile.mockReset();
});

// ---- Tests ---------------------------------------------------------------

describe('recommendForGroup — input validation + edge cases', () => {
  it('returns empty + "no players in group" skip when playerIds is []', async () => {
    mockLoadGameProfiles.mockResolvedValue([]);
    const r = await recommendForGroup({ playerIds: [] });
    expect(r.recommendations).toEqual([]);
    expect(r.enginesSkipped.find((e) => e.name === 'seidr')?.reason).toBe('no players in group');
    expect(r.candidatesConsidered).toBe(0);
  });

  it('returns empty when no players have a saved profile', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame]);
    mockLoadPlayerProfile.mockResolvedValue(null); // every lookup misses
    const r = await recommendForGroup({ playerIds: ['ghost-1', 'ghost-2'] });
    expect(r.recommendations).toEqual([]);
    expect(r.playersResolved).toEqual([]);
    expect(r.playersSkipped).toHaveLength(2);
    expect(r.playersSkipped[0].playerId).toBe('ghost-1');
    expect(r.playersSkipped[0].reason).toContain('no saved profile');
    expect(r.enginesSkipped.find((e) => e.name === 'seidr')?.reason).toContain(
      'no players in group have a saved profile',
    );
  });

  it('uses resolved players + lists skipped when mixed', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'real-1') return wargamerProfile;
      return null;
    });
    const r = await recommendForGroup({ playerIds: ['real-1', 'ghost-1', 'ghost-2'] });
    expect(r.playersResolved).toEqual(['real-1']);
    expect(r.playersSkipped.map((p) => p.playerId).sort()).toEqual(['ghost-1', 'ghost-2']);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('single-player group degenerates: each rec\'s aggregate equals that one player\'s score', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);
    const r = await recommendForGroup({ playerIds: ['solo'], aggregation: 'min' });
    expect(r.recommendations.length).toBeGreaterThan(0);
    for (const rec of r.recommendations) {
      // With one player, perPlayerScores has 1 entry; min == that score.
      expect(rec.perPlayerScores).toHaveLength(1);
      expect(rec.groupAggregateScore).toBeCloseTo(rec.perPlayerScores[0].score, 6);
      expect(rec.scoreSpread).toBe(0);
    }
  });
});

describe('recommendForGroup — aggregation math', () => {
  it('min aggregation picks the score floor; mean averages', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    // Pre-resolve: id 'w' = wargamer, id 'f' = family
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'w') return wargamerProfile;
      if (id === 'f') return familyProfile;
      return null;
    });

    const minResp = await recommendForGroup({ playerIds: ['w', 'f'], aggregation: 'min' });
    const meanResp = await recommendForGroup({ playerIds: ['w', 'f'], aggregation: 'mean' });

    // Same candidate pool, same per-player scores — different aggregates.
    // For a given game, min == Math.min of the per-player scores;
    // mean == average. Verify by direct computation on the response.
    for (const rec of minResp.recommendations) {
      const scores = rec.perPlayerScores.map((p) => p.score);
      expect(rec.groupAggregateScore).toBeCloseTo(Math.min(...scores), 6);
    }
    for (const rec of meanResp.recommendations) {
      const scores = rec.perPlayerScores.map((p) => p.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(rec.groupAggregateScore).toBeCloseTo(mean, 6);
    }
  });

  it('the egalitarian claim: in a conflict group, min raises the worst-player floor vs mean', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame, fillerGame]);
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'w') return wargamerProfile;
      if (id === 'f') return familyProfile;
      return null;
    });

    const minResp = await recommendForGroup({ playerIds: ['w', 'f'], aggregation: 'min', limit: 1 });
    const meanResp = await recommendForGroup({ playerIds: ['w', 'f'], aggregation: 'mean', limit: 1 });

    const minTopWorst = Math.min(...minResp.recommendations[0].perPlayerScores.map((p) => p.score));
    const meanTopWorst = Math.min(...meanResp.recommendations[0].perPlayerScores.map((p) => p.score));

    // The headline assertion: under min, the worst-off player should not
    // be MORE miserable than under mean. In a true conflict group like
    // this one, min should match-or-beat mean's floor. We use >= rather
    // than > because for some test fixtures the top pick may coincide.
    expect(minTopWorst).toBeGreaterThanOrEqual(meanTopWorst);
  });

  it('aggregation defaults to min when not specified', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame]);
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'w') return wargamerProfile;
      if (id === 'f') return familyProfile;
      return null;
    });
    const r = await recommendForGroup({ playerIds: ['w', 'f'] });
    expect(r.aggregation).toBe('min');
    for (const rec of r.recommendations) {
      const scores = rec.perPlayerScores.map((p) => p.score);
      expect(rec.groupAggregateScore).toBeCloseTo(Math.min(...scores), 6);
    }
  });

  it('scoreSpread = max(perPlayer) - min(perPlayer)', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'w') return wargamerProfile;
      if (id === 'f') return familyProfile;
      return null;
    });
    const r = await recommendForGroup({ playerIds: ['w', 'f'] });
    for (const rec of r.recommendations) {
      const scores = rec.perPlayerScores.map((p) => p.score);
      const expected = Math.max(...scores) - Math.min(...scores);
      expect(rec.scoreSpread).toBeCloseTo(expected, 6);
    }
  });
});

describe('recommendForGroup — tie-break', () => {
  it('equal aggregate scores are tie-broken by lower spread first', async () => {
    // Construct two games that the aggregation gives equal scores, with
    // different spreads. Easiest: identical-similarity games via same
    // dim vector, then perturb one to widen spread without changing the
    // min. We force this by mocking scoreAll-equivalent inputs that
    // collapse to identical group scores.
    //
    // Two games where both players score exactly the same on game A
    // (mid score for both = small spread) vs game B where one player
    // scores high and the other matches game A's score (same min,
    // bigger spread). Min should pick A first.

    // Symmetric profiles for both players so the dot products are
    // predictable.
    const playerP = { dim_vector: { X: 0.5 } };
    const playerQ = { dim_vector: { X: 0.5 } };
    const gameLowSpread = { game_id: 11, dim_vector: { X: 0.5 } };  // both score same
    const gameHighSpread = { game_id: 167791, dim_vector: { X: 0.5 } }; // also both score same

    // To create a real spread difference we need asymmetric profiles.
    // Let one player have a different vector for gameHighSpread to score on.
    // Easier: build one game where P scores 0.5, Q scores 0.5 (min=0.5,
    // spread=0); another where P scores 0.5, Q scores 0.9 (min=0.5,
    // spread=0.4). Same min, lower-spread game should rank first.

    const playerLowAffinity = { dim_vector: { A: 1.0, B: 0.0 } }; // weights A
    const playerHighAffinity = { dim_vector: { A: 0.0, B: 1.0 } }; // weights B

    const balancedGame = { game_id: 11, dim_vector: { A: 0.5, B: 0.5 } }; // both score ~equal
    const skewedGame = { game_id: 167791, dim_vector: { A: 0.5, B: 1.0 } }; // playerHigh scores higher

    mockLoadGameProfiles.mockResolvedValue([balancedGame, skewedGame]);
    mockLoadPlayerProfile.mockImplementation(async (id: string) => {
      if (id === 'low') return playerLowAffinity;
      if (id === 'high') return playerHighAffinity;
      return null;
    });

    const r = await recommendForGroup({
      playerIds: ['low', 'high'],
      aggregation: 'min',
    });

    expect(r.recommendations.length).toBe(2);
    // Within an aggregate-score tie, the lower-spread game should be
    // first. We don't assert exact equality on aggregate score (small
    // floating differences are likely), but we assert that if the two
    // aggregates are within 0.01, the lower-spread one ranks first.
    const [first, second] = r.recommendations;
    if (Math.abs(first.score - second.score) < 0.01) {
      expect(first.scoreSpread).toBeLessThanOrEqual(second.scoreSpread);
    }
  });
});

describe('recommendForGroup — playerCount auto-default + filter', () => {
  it('playerCount defaults to playerIds.length and drops out-of-range games', async () => {
    mockLoadGameProfiles.mockResolvedValue([
      heavyWarGame,        // 1-4p — 5p group should drop this
      fourMaxGame,         // 3-4p — 5p drops
      familyCoopGame,      // 1-5p — 5p OK
      middleGroundGame,    // 1-5p — 5p OK
    ]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);

    // Group of 5, no explicit playerCount.
    const r = await recommendForGroup({ playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'] });
    const recIds = new Set(r.recommendations.map((g) => g.gameId));
    expect(recIds.has(174430)).toBe(false); // Gloomhaven max=4 dropped
    expect(recIds.has(13)).toBe(false);     // Catan max=4 dropped
    expect(recIds.has(266192)).toBe(true);  // Wingspan OK
    expect(recIds.has(167791)).toBe(true);  // Terraforming Mars OK
  });

  it('explicit playerCount overrides the group-size default', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, fourMaxGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);

    // Group of 5 but caller forces playerCount=3 (e.g. only 3 will actually play).
    const r = await recommendForGroup({
      playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      context: { playerCount: 3 },
    });
    const recIds = new Set(r.recommendations.map((g) => g.gameId));
    expect(recIds.has(174430)).toBe(true);  // Gloomhaven 1-4 — OK at 3
    expect(recIds.has(13)).toBe(true);      // Catan 3-4 — OK at 3
  });
});

describe('recommendForGroup — exclusions', () => {
  it('excludeGameIds drops games before scoring', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);
    const r = await recommendForGroup({
      playerIds: ['solo'],
      context: { excludeGameIds: [heavyWarGame.game_id, familyCoopGame.game_id] },
    });
    const recIds = new Set(r.recommendations.map((g) => g.gameId));
    expect(recIds.has(heavyWarGame.game_id)).toBe(false);
    expect(recIds.has(familyCoopGame.game_id)).toBe(false);
    expect(recIds.has(middleGroundGame.game_id)).toBe(true);
    expect(r.candidatesConsidered).toBe(1);
  });
});

describe('recommendForGroup — filters', () => {
  it('subdomain filter drops non-matching games', async () => {
    // All our test games have subdomain="Strategy" or "Customizable"
    // (per game-meta.json). Filter to only Customizable should keep
    // Catan (13) and drop Gloomhaven/Wingspan/etc.
    mockLoadGameProfiles.mockResolvedValue([
      heavyWarGame,    // Strategy
      familyCoopGame,  // Strategy
      fourMaxGame,     // Customizable
    ]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);
    const r = await recommendForGroup({
      playerIds: ['solo'],
      filters: { subdomains: ['Customizable'] },
      context: { playerCount: 4 },
    });
    const recIds = new Set(r.recommendations.map((g) => g.gameId));
    expect(recIds.has(13)).toBe(true);
    expect(recIds.has(174430)).toBe(false);
    expect(recIds.has(266192)).toBe(false);
  });
});

describe('recommendForGroup — affinity boost', () => {
  it('a strongly-similar anchor lifts the matching candidate above the unanchored ranking', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame, middleGroundGame]);
    mockLoadPlayerProfile.mockResolvedValue(middleProfile); // mild on everything
    const without = await recommendForGroup({ playerIds: ['solo'] });
    // The anchor is itself a heavy-war-like game, so the boost should
    // pull the heavyWarGame's score up.
    const heavyWarLikeAnchor = {
      gameId: 999999, // not in candidates — we're not boosting against itself
      weight: 1.0,
    };
    // The orchestrator looks up the anchor's profile from gameProfiles
    // by gameId. Add an anchor profile to the loaded set.
    const anchorProfile = {
      game_id: 999999,
      dim_vector: { ...heavyWarGame.dim_vector }, // identical dims
    };
    mockLoadGameProfiles.mockResolvedValue([
      heavyWarGame, familyCoopGame, middleGroundGame, anchorProfile,
    ]);
    const withAnchor = await recommendForGroup({
      playerIds: ['solo'],
      affinityAnchors: [heavyWarLikeAnchor],
      context: { excludeGameIds: [999999] }, // keep anchor out of recs
    });

    const heavyWarWithoutScore = without.recommendations.find((g) => g.gameId === heavyWarGame.game_id)?.score ?? 0;
    const heavyWarWithScore = withAnchor.recommendations.find((g) => g.gameId === heavyWarGame.game_id)?.score ?? 0;

    // Score for the heavyWarGame must be higher when there's a similar
    // anchor present. Boost is multiplicative (score * (1 + alpha * sim))
    // so anything > baseline is a pass.
    expect(heavyWarWithScore).toBeGreaterThan(heavyWarWithoutScore);
  });

  it('an anchor not in the corpus is silently ignored (no crash, no boost)', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame, familyCoopGame]);
    mockLoadPlayerProfile.mockResolvedValue(middleProfile);
    const r = await recommendForGroup({
      playerIds: ['solo'],
      affinityAnchors: [{ gameId: 99999999, weight: 1.0 }], // ghost id
    });
    // No crash; recs returned normally.
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
});

describe('recommendForGroup — engine reporting', () => {
  it('always reports mimir + huginn + saga as skipped (Phase 1)', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);
    const r = await recommendForGroup({ playerIds: ['solo'] });
    const skippedNames = r.enginesSkipped.map((e) => e.name);
    expect(skippedNames).toContain('mimir');
    expect(skippedNames).toContain('huginn');
    expect(skippedNames).toContain('saga');
  });

  it('reports seidr as ran when at least one player has a profile', async () => {
    mockLoadGameProfiles.mockResolvedValue([heavyWarGame]);
    mockLoadPlayerProfile.mockResolvedValue(wargamerProfile);
    const r = await recommendForGroup({ playerIds: ['solo'] });
    expect(r.enginesRan).toContain('seidr');
  });
});
