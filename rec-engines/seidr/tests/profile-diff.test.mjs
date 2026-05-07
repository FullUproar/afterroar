// profile-diff.test.mjs
// ============================================================================
// Tests for src/profile-diff.mjs.
//
// Pure-function tests + integration test that asserts the 7 reference
// profiles (data/reference-profiles.json) remain consistent with their
// counterparts in the seed corpus (data/seed-game-profiles.json) for the
// games that overlap.
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffProfile, diffCorpora } from '../src/profile-diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function profile(id, overrides = {}) {
  return {
    game_id: id,
    dim_vector: { A: 0, B: 0, C: 0, ...overrides },
    confidence_per_dim: { A: 1, B: 1, C: 1 },
  };
}

// ----------------------------------------------------------------------------
// diffProfile: argument validation
// ----------------------------------------------------------------------------

test('diffProfile: throws on null inputs', () => {
  assert.throws(() => diffProfile(null, profile(1)), /required/);
  assert.throws(() => diffProfile(profile(1), null), /required/);
});

test('diffProfile: throws on game_id mismatch', () => {
  assert.throws(
    () => diffProfile(profile(1), profile(2)),
    /game_id mismatch/
  );
});

test('diffProfile: throws on missing dim in profile B', () => {
  const a = profile(1, { A: 0.5 });
  const b = { game_id: 1, dim_vector: { A: 0.5 } }; // missing B, C
  assert.throws(() => diffProfile(a, b), /missing dim/);
});

test('diffProfile: throws on missing dim in profile A', () => {
  const a = { game_id: 1, dim_vector: { A: 0.5 } };
  const b = profile(1);
  assert.throws(() => diffProfile(a, b), /missing dim/);
});

// ----------------------------------------------------------------------------
// diffProfile: identity case (zero deltas)
// ----------------------------------------------------------------------------

test('diffProfile: identity diff yields zero distance', () => {
  const p = profile(1, { A: 0.5, B: -0.3, C: 0.2 });
  const d = diffProfile(p, p);
  assert.equal(d.game_id, 1);
  assert.equal(d.l2_distance, 0);
  assert.equal(d.mean_abs_delta, 0);
  assert.equal(d.max_abs_delta, 0);
  assert.equal(d.significant_dims.length, 0);
});

// ----------------------------------------------------------------------------
// diffProfile: directional deltas
// ----------------------------------------------------------------------------

test('diffProfile: positive delta reflects from -> to direction', () => {
  const a = profile(1, { A: 0.0, B: 0, C: 0 });
  const b = profile(1, { A: 0.5, B: 0, C: 0 });
  const d = diffProfile(a, b);
  assert.equal(d.all_dims.A.from, 0);
  assert.equal(d.all_dims.A.to, 0.5);
  assert.equal(d.all_dims.A.delta, 0.5);
});

test('diffProfile: l2 distance computed correctly', () => {
  const a = profile(1, { A: 0, B: 0, C: 0 });
  const b = profile(1, { A: 0.3, B: 0.4, C: 0 });
  const d = diffProfile(a, b);
  assert.ok(Math.abs(d.l2_distance - 0.5) < 1e-9, `expected 0.5, got ${d.l2_distance}`);
});

// ----------------------------------------------------------------------------
// diffProfile: significance threshold
// ----------------------------------------------------------------------------

test('diffProfile: significant dims filtered by default threshold (0.15)', () => {
  const a = profile(1, { A: 0, B: 0, C: 0 });
  const b = profile(1, { A: 0.2, B: 0.05, C: -0.18 });
  const d = diffProfile(a, b);
  // A (0.2) and C (-0.18) above; B (0.05) below
  assert.equal(d.significant_dims.length, 2);
  const dims = d.significant_dims.map(s => s.dim);
  assert.ok(dims.includes('A'));
  assert.ok(dims.includes('C'));
  assert.ok(!dims.includes('B'));
});

test('diffProfile: custom significantDelta threshold', () => {
  const a = profile(1, { A: 0, B: 0, C: 0 });
  const b = profile(1, { A: 0.1, B: 0.05, C: -0.08 });
  const d = diffProfile(a, b, { significantDelta: 0.05 });
  // All three above 0.05 threshold
  assert.equal(d.significant_dims.length, 3);
});

test('diffProfile: significant dims sorted by absolute delta descending', () => {
  const a = profile(1, { A: 0, B: 0, C: 0 });
  const b = profile(1, { A: 0.2, B: 0.5, C: -0.3 });
  const d = diffProfile(a, b);
  assert.equal(d.significant_dims[0].dim, 'B');
  assert.equal(d.significant_dims[1].dim, 'C');
  assert.equal(d.significant_dims[2].dim, 'A');
});

// ----------------------------------------------------------------------------
// diffCorpora: argument validation
// ----------------------------------------------------------------------------

test('diffCorpora: throws on non-array inputs', () => {
  assert.throws(() => diffCorpora('not-array', []), /must be an array/);
  assert.throws(() => diffCorpora([], 'not-array'), /must be an array/);
});

// ----------------------------------------------------------------------------
// diffCorpora: identity case
// ----------------------------------------------------------------------------

test('diffCorpora: identity diff has zero summary L2', () => {
  const corpus = [
    profile(1, { A: 0.5 }),
    profile(2, { B: -0.3 }),
    profile(3, { C: 0.7 }),
  ];
  const r = diffCorpora(corpus, corpus);
  assert.equal(r.summary.total_in_both, 3);
  assert.equal(r.only_in_a.length, 0);
  assert.equal(r.only_in_b.length, 0);
  assert.equal(r.summary.mean_l2_distance, 0);
  assert.equal(r.summary.max_l2_distance, 0);
  assert.equal(r.summary.games_with_significant_drift, 0);
});

// ----------------------------------------------------------------------------
// diffCorpora: only-in-A / only-in-B
// ----------------------------------------------------------------------------

test('diffCorpora: surfaces only-in-A', () => {
  const a = [profile(1), profile(2), profile(3)];
  const b = [profile(2), profile(3)];
  const r = diffCorpora(a, b);
  assert.deepEqual(r.only_in_a, [1]);
  assert.deepEqual(r.only_in_b, []);
  assert.equal(r.summary.total_in_both, 2);
});

test('diffCorpora: surfaces only-in-B', () => {
  const a = [profile(1), profile(2)];
  const b = [profile(1), profile(2), profile(99)];
  const r = diffCorpora(a, b);
  assert.deepEqual(r.only_in_a, []);
  assert.deepEqual(r.only_in_b, [99]);
  assert.equal(r.summary.total_in_both, 2);
});

test('diffCorpora: handles disjoint corpora', () => {
  const a = [profile(1), profile(2)];
  const b = [profile(3), profile(4)];
  const r = diffCorpora(a, b);
  assert.equal(r.summary.total_in_both, 0);
  assert.deepEqual(r.only_in_a, [1, 2]);
  assert.deepEqual(r.only_in_b, [3, 4]);
});

// ----------------------------------------------------------------------------
// diffCorpora: drift detection
// ----------------------------------------------------------------------------

test('diffCorpora: counts games with significant drift', () => {
  const a = [
    profile(1, { A: 0 }),
    profile(2, { A: 0 }),
    profile(3, { A: 0 }),
  ];
  const b = [
    profile(1, { A: 0.5 }),    // drifted
    profile(2, { A: 0.05 }),   // not drifted
    profile(3, { A: 0.3 }),    // drifted
  ];
  const r = diffCorpora(a, b);
  assert.equal(r.summary.games_with_significant_drift, 2);
});

test('diffCorpora: diffs sorted by l2 distance descending', () => {
  const a = [profile(1), profile(2), profile(3)];
  const b = [
    profile(1, { A: 0.5 }),     // L2 = 0.5
    profile(2, { A: 0.1 }),     // L2 = 0.1
    profile(3, { A: 0.3 }),     // L2 = 0.3
  ];
  const r = diffCorpora(a, b);
  const ids = r.diffs.map(d => d.game_id);
  assert.deepEqual(ids, [1, 3, 2]);
});

// ----------------------------------------------------------------------------
// Integration: reference profiles vs seed corpus calibration anchor
// ----------------------------------------------------------------------------

test('CALIBRATION ANCHOR: 7 reference profiles match seed-corpus equivalents within tolerance', () => {
  const refRaw = JSON.parse(readFileSync(
    resolve(__dirname, '..', 'data', 'reference-profiles.json'), 'utf8'));
  const seedRaw = JSON.parse(readFileSync(
    resolve(__dirname, '..', 'data', 'seed-game-profiles.json'), 'utf8'));

  // The reference profiles use `confidence_per_dim` as the key; seed corpus
  // uses the same key. game_name is on the reference but not in seed.
  // Both use `dim_vector` and `game_id`.
  const refProfiles = refRaw.profiles.map(p => ({
    game_id: p.game_id,
    dim_vector: p.dim_vector,
    confidence_per_dim: p.confidence_per_dim,
  }));
  const seedProfiles = seedRaw.profiles;

  const r = diffCorpora(refProfiles, seedProfiles);

  // Of 7 reference games, 6 are in the seed corpus (Pandemic 30549 isn't —
  // it's not in BGG top-25 anymore, only Pandemic Legacy variants are).
  assert.ok(r.summary.total_in_both >= 6,
    `expected at least 6 reference games in seed corpus; got ${r.summary.total_in_both}`);

  // The 6 overlapping profiles should be IDENTICAL (Sprint 1.0.18's reference
  // profiles were the seed for Sprint 1.0.24's hand-authored seed corpus —
  // any drift is a regression).
  for (const d of r.diffs) {
    assert.ok(d.l2_distance < 0.05,
      `reference vs seed drift on game_id ${d.game_id}: L2=${d.l2_distance.toFixed(4)} (significant_dims: ${d.significant_dims.map(s => s.dim).join(', ')})`);
  }
});

test('CALIBRATION ANCHOR: only-in-reference games are documented (Pandemic 30549 only)', () => {
  const refRaw = JSON.parse(readFileSync(
    resolve(__dirname, '..', 'data', 'reference-profiles.json'), 'utf8'));
  const seedRaw = JSON.parse(readFileSync(
    resolve(__dirname, '..', 'data', 'seed-game-profiles.json'), 'utf8'));

  const refProfiles = refRaw.profiles.map(p => ({
    game_id: p.game_id,
    dim_vector: p.dim_vector,
    confidence_per_dim: p.confidence_per_dim,
  }));

  const r = diffCorpora(refProfiles, seedRaw.profiles);
  // Pandemic (30549) is in references but not in BGG top-25 bundle (only
  // Pandemic Legacy variants are). This is documented behavior, not drift.
  assert.deepEqual(r.only_in_a.sort(), [30549]);
});
