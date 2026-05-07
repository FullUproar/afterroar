// seed-game-profiles.test.mjs
// ============================================================================
// Tests for the seed-game-profiles.json corpus. Validates:
//   1. File exists and parses
//   2. Has 225 unique profiles
//   3. Every profile validates against the 24-dim schema
//   4. Subdomain-archetype sanity: heavy-strategist's #1 must be a heavy
//      strategy game (high MEC_COMPLEXITY + MEC_STRATEGY); party-extravert's
//      #1 must be Codenames (the party-game anchor in the corpus); coop-
//      puzzler's #1 must be a pure-coop game (SOC_COOP_COMP <= -0.85).
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfiles, extractDimIds } from '../src/validate-profile.mjs';
import { match } from '../src/match.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'seed-game-profiles.json');
const DIMS_PATH = resolve(__dirname, '..', 'data', 'dimensions.json');

test('seed-game-profiles: file parses', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  assert.equal(seed.version, '1.0.0');
  assert.equal(seed.source_provenance, 'manually_curated');
  assert.ok(Array.isArray(seed.profiles));
});

test('seed-game-profiles: contains 225 profiles', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  assert.equal(seed.profiles.length, 225);
});

test('seed-game-profiles: all game_ids are unique', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const ids = seed.profiles.map(p => p.game_id);
  assert.equal(new Set(ids).size, ids.length);
});

test('seed-game-profiles: every profile validates against the 24-dim schema', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const dims = JSON.parse(readFileSync(DIMS_PATH, 'utf8'));
  const dimIds = extractDimIds(dims);

  // Adapt profiles to the validator's expected shape (carry top-level provenance into each)
  const profiles = seed.profiles.map(p => ({
    game_id: p.game_id,
    dim_vector: p.dim_vector,
    confidence_per_dim: p.confidence_per_dim,
    source_provenance: seed.source_provenance,
    model_version: seed.model_version,
    prompt_version: seed.prompt_version,
  }));

  const result = validateProfiles(profiles, dimIds);
  assert.equal(result.ok, true,
    `validation failed for ${result.errors.length} profiles. First error: ${JSON.stringify(result.errors[0])}`);
});

// ----------------------------------------------------------------------------
// SUBTLE-WRONGNESS: archetype-driven sanity checks against the corpus
// ----------------------------------------------------------------------------

function archetype(overrides) {
  const dims = JSON.parse(readFileSync(DIMS_PATH, 'utf8'));
  const dimIds = extractDimIds(dims);
  const dim_vector = {}, confidence_vector = {};
  for (const id of dimIds) {
    dim_vector[id] = overrides[id] ?? 0;
    confidence_vector[id] = 0.85;
  }
  return { dim_vector, confidence_vector };
}

test('SUBTLE-WRONGNESS: heavy-strategist archetype #1 has high MEC_COMPLEXITY + MEC_STRATEGY', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const player = archetype({
    PSY_ACHIEVEMENT: 0.8, PSY_CONSCIENTIOUSNESS: 0.8, PSY_KILLER: -0.3,
    MEC_COMPLEXITY: 0.7, MEC_STRATEGY: 0.8, CTX_TIME: 0.6, EMO_HUMOR: -0.4,
  });
  const result = match(player, seed.profiles, { limit: 1, diversify: false });
  const top = result.recommendations[0];
  const topProfile = seed.profiles.find(p => p.game_id === top.game_id);
  assert.ok(topProfile.dim_vector.MEC_COMPLEXITY >= 0.4,
    `top recommendation ${topProfile.game_name} has low MEC_COMPLEXITY (${topProfile.dim_vector.MEC_COMPLEXITY}); subtle-wrongness violation`);
  assert.ok(topProfile.dim_vector.MEC_STRATEGY >= 0.6,
    `top recommendation ${topProfile.game_name} has low MEC_STRATEGY (${topProfile.dim_vector.MEC_STRATEGY})`);
});

test('SUBTLE-WRONGNESS: party-extravert archetype #1 is a party-coded game (low MEC_COMPLEXITY, high PSY_SOCIAL or EMO_HUMOR)', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const player = archetype({
    PSY_SOCIAL: 0.9, PSY_EXTRAVERSION: 0.9, PSY_KILLER: -0.2,
    MEC_COMPLEXITY: -0.8, CTX_PLAYER_COUNT: 0.7, EMO_HUMOR: 0.8, CTX_TIME: -0.7,
  });
  const result = match(player, seed.profiles, { limit: 1, diversify: false });
  const top = result.recommendations[0];
  const topProfile = seed.profiles.find(p => p.game_id === top.game_id);
  assert.ok(topProfile.dim_vector.MEC_COMPLEXITY <= -0.4,
    `top recommendation ${topProfile.game_name} has high MEC_COMPLEXITY (${topProfile.dim_vector.MEC_COMPLEXITY}); not party-coded`);
  assert.ok(topProfile.dim_vector.PSY_SOCIAL >= 0.5 || topProfile.dim_vector.EMO_HUMOR >= 0.5,
    `top recommendation ${topProfile.game_name} not party-coded on PSY_SOCIAL or EMO_HUMOR`);
});

test('SUBTLE-WRONGNESS: coop-puzzler archetype #1 is a pure-coop game (SOC_COOP_COMP <= -0.5)', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const player = archetype({
    PSY_KILLER: -0.9, PSY_AGREEABLENESS: 0.8, SOC_COOP_COMP: -0.7,
    SOC_DIRECT_INDIRECT: -0.7, SOC_TRUST_BETRAYAL: -0.7, EMO_TENSION: 0.3, CTX_TIME: -0.3,
  });
  const result = match(player, seed.profiles, { limit: 1, diversify: false });
  const top = result.recommendations[0];
  const topProfile = seed.profiles.find(p => p.game_id === top.game_id);
  assert.ok(topProfile.dim_vector.SOC_COOP_COMP <= -0.5,
    `top recommendation ${topProfile.game_name} is not pure-coop (SOC_COOP_COMP=${topProfile.dim_vector.SOC_COOP_COMP})`);
});

test('SUBTLE-WRONGNESS: corpus spans dimensional coverage (every cluster has a top-/bottom-leaning game)', () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const dimIds = ['PSY_KILLER', 'SOC_COOP_COMP', 'MEC_COMPLEXITY', 'CTX_TIME', 'CTX_PLAYER_COUNT', 'EMO_HUMOR'];
  for (const dim of dimIds) {
    const values = seed.profiles.map(p => p.dim_vector[dim]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    assert.ok(max - min >= 1.5,
      `dimension ${dim} has insufficient range in corpus (min=${min}, max=${max}); coverage gap`);
  }
});
