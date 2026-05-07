// find-similar.test.mjs
// ============================================================================
// Tests for src/find-similar.mjs.
//
// Pure-function tests (no I/O) plus subtle-wrongness assertions against the
// real seed corpus.
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSimilarGames, findSimilarBatch } from '../src/find-similar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'seed-game-profiles.json');

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));

// Synthetic dim-space for unit tests; allows specific cosine relationships
// to be enforced without leaning on the real corpus.
function synthGame(id, vec) {
  return {
    game_id: id,
    dim_vector: { A: 0, B: 0, C: 0, ...vec },
    confidence_per_dim: { A: 1, B: 1, C: 1 },
  };
}

// ----------------------------------------------------------------------------
// Argument validation
// ----------------------------------------------------------------------------

test('findSimilarGames: throws on non-integer source id', () => {
  assert.throws(
    () => findSimilarGames('not-an-int', [synthGame(1, { A: 1 })]),
    /must be an integer/
  );
});

test('findSimilarGames: throws on non-array gameProfiles', () => {
  assert.throws(
    () => findSimilarGames(1, 'not-array'),
    /must be an array/
  );
});

test('findSimilarGames: throws when source not in corpus', () => {
  assert.throws(
    () => findSimilarGames(999, [synthGame(1, { A: 1 })]),
    /not found in corpus/
  );
});

// ----------------------------------------------------------------------------
// Core behavior
// ----------------------------------------------------------------------------

test('findSimilarGames: source itself is excluded from results', () => {
  const corpus = [
    synthGame(1, { A: 1 }),
    synthGame(2, { A: 1 }),
    synthGame(3, { A: -1 }),
  ];
  const result = findSimilarGames(1, corpus);
  const ids = result.recommendations.map(r => r.game_id);
  assert.ok(!ids.includes(1), 'source game leaked into its own similar list');
});

test('findSimilarGames: ranks by cosine descending', () => {
  const corpus = [
    synthGame(1, { A: 1, B: 0 }),
    synthGame(2, { A: 1, B: 0 }),     // identical to 1 -> cosine 1
    synthGame(3, { A: 0.5, B: 0.5 }), // partial alignment
    synthGame(4, { A: -1, B: 0 }),    // opposite -> cosine -1
  ];
  const result = findSimilarGames(1, corpus);
  assert.equal(result.recommendations[0].game_id, 2, 'identical game should rank #1');
  assert.equal(result.recommendations[result.recommendations.length - 1].game_id, 4,
    'opposite game should rank last');
});

test('findSimilarGames: returns the source object', () => {
  const corpus = [
    synthGame(42, { A: 0.5 }),
    synthGame(99, { A: 1 }),
  ];
  const result = findSimilarGames(42, corpus);
  assert.equal(result.source.game_id, 42);
});

test('findSimilarGames: limit honored', () => {
  const corpus = [];
  for (let i = 1; i <= 20; i++) {
    corpus.push(synthGame(i, { A: i / 20 }));
  }
  const result = findSimilarGames(1, corpus, { limit: 5 });
  assert.equal(result.recommendations.length, 5);
});

test('findSimilarGames: default limit is 10', () => {
  const corpus = [];
  for (let i = 1; i <= 50; i++) {
    corpus.push(synthGame(i, { A: i / 50 }));
  }
  const result = findSimilarGames(1, corpus);
  assert.equal(result.recommendations.length, 10);
});

test('findSimilarGames: corpus smaller than limit returns all available', () => {
  const corpus = [
    synthGame(1, { A: 1 }),
    synthGame(2, { A: 0.5 }),
    synthGame(3, { A: 0.3 }),
  ];
  const result = findSimilarGames(1, corpus, { limit: 100 });
  assert.equal(result.recommendations.length, 2); // 3 - source = 2
});

test('findSimilarGames: excludeGameIds filters additional games', () => {
  const corpus = [
    synthGame(1, { A: 1 }),
    synthGame(2, { A: 1 }),
    synthGame(3, { A: 1 }),
  ];
  const result = findSimilarGames(1, corpus, { excludeGameIds: [2] });
  const ids = result.recommendations.map(r => r.game_id);
  assert.ok(!ids.includes(1) && !ids.includes(2));
  assert.deepEqual(ids, [3]);
});

test('findSimilarGames: every recommendation carries cosine + profile', () => {
  const corpus = [synthGame(1, { A: 1 }), synthGame(2, { A: 0.5 })];
  const result = findSimilarGames(1, corpus);
  for (const rec of result.recommendations) {
    assert.ok(typeof rec.cosine === 'number');
    assert.ok(rec.profile);
    assert.equal(rec.profile.game_id, rec.game_id);
  }
});

// ----------------------------------------------------------------------------
// findSimilarBatch
// ----------------------------------------------------------------------------

test('findSimilarBatch: returns one result per source id', () => {
  const corpus = [
    synthGame(1, { A: 1 }),
    synthGame(2, { A: 0.5 }),
    synthGame(3, { A: 0 }),
  ];
  const results = findSimilarBatch([1, 2, 3], corpus);
  assert.equal(results.length, 3);
  assert.equal(results[0].source.game_id, 1);
  assert.equal(results[1].source.game_id, 2);
  assert.equal(results[2].source.game_id, 3);
});

test('findSimilarBatch: throws on non-array sourceGameIds', () => {
  assert.throws(
    () => findSimilarBatch('not-array', [synthGame(1, { A: 1 })]),
    /must be an array/
  );
});

// ----------------------------------------------------------------------------
// SUBTLE-WRONGNESS: real seed corpus produces dimensionally-correct clusters
// ----------------------------------------------------------------------------

test('SUBTLE-WRONGNESS: most similar to Brass: Birmingham is Brass: Lancashire', () => {
  const result = findSimilarGames(224517, seed.profiles, { limit: 1 });
  assert.equal(result.recommendations[0].game_id, 28720,
    `expected Brass: Lancashire (28720), got game_id ${result.recommendations[0].game_id}`);
});

test('SUBTLE-WRONGNESS: most similar to Pandemic Legacy S1 is one of the other Pandemic Legacy seasons', () => {
  const result = findSimilarGames(161936, seed.profiles, { limit: 2 });
  const top2Ids = result.recommendations.map(r => r.game_id);
  // Pandemic Legacy: Season 2 (221107) or Season 0 (314040) should be top-2
  assert.ok(top2Ids.includes(221107) || top2Ids.includes(314040),
    `expected a Pandemic Legacy variant in top-2, got: ${top2Ids}`);
});

test('SUBTLE-WRONGNESS: most similar to Codenames is a party word/charades game', () => {
  const result = findSimilarGames(178900, seed.profiles, { limit: 5 });
  const top5Profiles = result.recommendations.map(r => r.profile);
  // Top-5 should all have low MEC_COMPLEXITY (party-coded)
  for (const p of top5Profiles) {
    assert.ok(p.dim_vector.MEC_COMPLEXITY <= -0.4,
      `Codenames similar pick ${p.game_name || p.game_id} not party-coded (MEC_COMPLEXITY=${p.dim_vector.MEC_COMPLEXITY})`);
  }
});

test('SUBTLE-WRONGNESS: most similar to TI4 is a heavy multi-player asymmetric strategy game', () => {
  const result = findSimilarGames(233078, seed.profiles, { limit: 5 });
  for (const rec of result.recommendations) {
    assert.ok(rec.profile.dim_vector.MEC_COMPLEXITY >= 0.5,
      `TI4 similar pick ${rec.profile.game_name || rec.game_id} too light (MEC_COMPLEXITY=${rec.profile.dim_vector.MEC_COMPLEXITY})`);
  }
});

test('SUBTLE-WRONGNESS: most similar to a kid game is another kid game', () => {
  // Zombie Kidz Evolution -> should pull other kids' games
  const result = findSimilarGames(256952, seed.profiles, { limit: 3 });
  for (const rec of result.recommendations) {
    const p = rec.profile;
    // Kids' games have very low MEC_COMPLEXITY AND very low PSY_KILLER
    assert.ok(p.dim_vector.MEC_COMPLEXITY <= -0.4,
      `Zombie Kidz similar pick ${p.game_name || rec.game_id} too heavy`);
    assert.ok(p.dim_vector.PSY_KILLER <= -0.4,
      `Zombie Kidz similar pick ${p.game_name || rec.game_id} too aggressive`);
  }
});

test('SUBTLE-WRONGNESS: top-1 cosine is always >= 0 in real corpus (no orphan dimensions)', () => {
  // Spot-check 5 games from across the corpus
  const sampleIds = [224517, 178900, 161936, 174430, 240980];
  for (const id of sampleIds) {
    const result = findSimilarGames(id, seed.profiles, { limit: 1 });
    assert.ok(result.recommendations[0].cosine >= 0,
      `game_id ${id} has no positive-cosine neighbor in the corpus (top cosine: ${result.recommendations[0].cosine})`);
  }
});

// ----------------------------------------------------------------------------
// Performance smoke: full corpus scan should be fast
// ----------------------------------------------------------------------------

test('findSimilarGames: completes a 225-corpus scan in < 500ms', () => {
  const start = Date.now();
  for (let i = 0; i < 10; i++) {
    findSimilarGames(224517, seed.profiles, { limit: 10 });
  }
  const ms = Date.now() - start;
  assert.ok(ms < 500, `10 full-corpus scans took ${ms}ms (expected < 500ms)`);
});
