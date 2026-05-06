// load-player-profile.test.mjs
// ============================================================================
// Tests for src/load-player-profile.mjs.
//
// The normalizer is a pure function. These tests construct profile objects
// in each accepted shape and assert that the normalized output is correct.
//
// Includes integration test: the real sample-quiz-export.json normalizes
// cleanly and produces a profile that the matcher can consume.
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerProfile, withLabel } from '../src/load-player-profile.mjs';

// ----------------------------------------------------------------------------
// Shape detection: quiz UI export
// ----------------------------------------------------------------------------

test('normalize: quiz UI export shape detected and translated', () => {
  const input = {
    meta: { bank_version: '1.0.0', questions_answered: 18, timestamp: '2026-05-06T12:00:00Z' },
    profile: { PSY_ACHIEVEMENT: 0.5, PSY_KILLER: -0.3 },
    confidence: { PSY_ACHIEVEMENT: 1.0, PSY_KILLER: 0.66 },
    raw: [{ question_id: 'Q01' }],
  };
  const out = normalizePlayerProfile(input);
  assert.deepEqual(out.dim_vector, { PSY_ACHIEVEMENT: 0.5, PSY_KILLER: -0.3 });
  assert.deepEqual(out.confidence_vector, { PSY_ACHIEVEMENT: 1.0, PSY_KILLER: 0.66 });
  assert.equal(out._meta.source, 'quiz_ui_export');
  assert.equal(out._meta.bank_version, '1.0.0');
  assert.equal(out._meta.questions_answered, 18);
});

test('normalize: quiz shape without meta block still detected', () => {
  const input = {
    profile: { A: 0.1 },
    confidence: { A: 1.0 },
  };
  const out = normalizePlayerProfile(input);
  assert.equal(out._meta.source, 'profile_confidence_pair');
  assert.deepEqual(out.dim_vector, { A: 0.1 });
});

test('normalize: quiz UI shape returns COPIES (not references) of dim/confidence', () => {
  const input = {
    profile: { A: 1 },
    confidence: { A: 1 },
  };
  const out = normalizePlayerProfile(input);
  out.dim_vector.A = 999;
  assert.equal(input.profile.A, 1, 'mutation of output leaked into input');
});

// ----------------------------------------------------------------------------
// Shape detection: matcher-native
// ----------------------------------------------------------------------------

test('normalize: matcher-native shape passes through unchanged', () => {
  const input = {
    dim_vector: { PSY_ACHIEVEMENT: 0.4 },
    confidence_vector: { PSY_ACHIEVEMENT: 0.8 },
  };
  const out = normalizePlayerProfile(input);
  assert.equal(out.dim_vector.PSY_ACHIEVEMENT, 0.4);
  assert.equal(out.confidence_vector.PSY_ACHIEVEMENT, 0.8);
  assert.equal(out._meta.source, 'matcher_native');
});

// ----------------------------------------------------------------------------
// Shape detection: game-profile-style alt confidence key
// ----------------------------------------------------------------------------

test('normalize: dim_vector + confidence_per_dim translates to canonical', () => {
  const input = {
    dim_vector: { PSY_KILLER: 0.5 },
    confidence_per_dim: { PSY_KILLER: 0.9 },
  };
  const out = normalizePlayerProfile(input);
  assert.equal(out.dim_vector.PSY_KILLER, 0.5);
  assert.equal(out.confidence_vector.PSY_KILLER, 0.9);
  assert.equal(out._meta.source, 'profile_with_alt_conf_key');
});

test('normalize: game profile (with game_id) flagged with original_game_id', () => {
  const input = {
    game_id: 167791,
    dim_vector: { PSY_KILLER: -0.4 },
    confidence_per_dim: { PSY_KILLER: 0.85 },
    narrative: 'A test game',
  };
  const out = normalizePlayerProfile(input);
  assert.equal(out._meta.source, 'game_profile_as_player');
  assert.equal(out._meta.original_game_id, 167791);
});

// ----------------------------------------------------------------------------
// Error paths
// ----------------------------------------------------------------------------

test('normalize: throws on null input', () => {
  assert.throws(() => normalizePlayerProfile(null), /must be an object/);
});

test('normalize: throws on string input', () => {
  assert.throws(() => normalizePlayerProfile('not a profile'), /must be an object/);
});

test('normalize: throws on object with neither known shape', () => {
  const input = { random: 'fields', count: 42 };
  assert.throws(() => normalizePlayerProfile(input), /does not match any known profile shape/);
});

test('normalize: throws when only one of (profile, confidence) is present', () => {
  // Half-quiz shape: should NOT match the quiz pattern
  const input = { profile: { A: 1 } };
  assert.throws(() => normalizePlayerProfile(input), /does not match/);
});

test('normalize: throws when dim_vector is present but neither confidence_vector nor confidence_per_dim', () => {
  const input = { dim_vector: { A: 1 } };
  assert.throws(() => normalizePlayerProfile(input), /does not match/);
});

test('normalize: rejects array input', () => {
  assert.throws(() => normalizePlayerProfile([1, 2, 3]), /must be an object/);
});

// ----------------------------------------------------------------------------
// withLabel helper
// ----------------------------------------------------------------------------

test('withLabel: attaches a label without mutating the source', () => {
  const profile = { dim_vector: {}, confidence_vector: {}, _meta: {} };
  const labeled = withLabel(profile, 'My Label');
  assert.equal(labeled.label, 'My Label');
  assert.ok(!('label' in profile), 'withLabel mutated source');
});

// ----------------------------------------------------------------------------
// Integration: real sample-quiz-export.json + matcher
// ----------------------------------------------------------------------------

test('integration: sample-quiz-export.json normalizes + flows through match()', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { match } = await import('../src/match.mjs');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sample = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'sample-quiz-export.json'), 'utf8'));
  const ref = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'reference-profiles.json'), 'utf8'));

  const player = normalizePlayerProfile(sample);
  assert.equal(player._meta.source, 'quiz_ui_export');
  assert.equal(player._meta.questions_answered, 18);

  // 24 dims should be present
  assert.equal(Object.keys(player.dim_vector).length, 24);
  assert.equal(Object.keys(player.confidence_vector).length, 24);

  // Run through match()
  const gameProfiles = ref.profiles.map(p => ({
    game_id: p.game_id,
    dim_vector: p.dim_vector,
    confidence_per_dim: p.confidence_per_dim,
  }));
  const result = match(player, gameProfiles, { limit: 7, diversify: false });

  // Matcher must produce results -- if normalization had failed silently
  // (key mismatch leading to empty intersection), the cosines would all be 0.
  assert.equal(result.recommendations.length, 7);
  // At least one result should have a meaningfully positive cosine
  const top = result.recommendations[0];
  assert.ok(top.cosineSimilarity > 0.5,
    `top recommendation cosine suspiciously low (${top.cosineSimilarity}); did normalization leak empty dim_vector?`);
});

test('integration: sample export player gets Wingspan or Cascadia or Ark Nova at top (low-conflict planner)', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { match } = await import('../src/match.mjs');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sample = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'sample-quiz-export.json'), 'utf8'));
  const ref = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'reference-profiles.json'), 'utf8'));

  const player = normalizePlayerProfile(sample);
  const gameProfiles = ref.profiles.map(p => ({
    game_id: p.game_id,
    dim_vector: p.dim_vector,
    confidence_per_dim: p.confidence_per_dim,
  }));
  const result = match(player, gameProfiles, { limit: 3, diversify: false });

  // The sample player is a peaceful low-conflict planner (PSY_KILLER -0.6,
  // PSY_CONSCIENTIOUSNESS 0.7, MEC_STRATEGY 0.6, AES_COMPONENT 0.5).
  // Top 3 should be the peaceful builders: Ark Nova / Wingspan / Cascadia / TM.
  // TI4 (high killer) and Codenames (party) MUST NOT appear in top 3.
  const ids = result.recommendations.map(r => r.game_id);
  assert.ok(!ids.includes(233078),
    `TI4 (PSY_KILLER 0.7, wargame) leaked into top-3 for low-killer player; got: ${ids}`);
  assert.ok(!ids.includes(178900),
    `Codenames (party) leaked into top-3 for low-conflict planner; got: ${ids}`);
});
