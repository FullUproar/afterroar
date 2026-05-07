// archetypes.test.mjs
// ============================================================================
// Tests for the built-in player archetypes in scripts/run-rec.mjs.
//
// Verifies that:
//   1. Each archetype profile has all 24 required dimensions
//   2. Each archetype's dim_vector values are in valid range [-1, 1]
//   3. buildArchetypeProfile produces a matcher-compatible shape
//   4. Each archetype's #1 recommendation against the seed corpus lands in
//      its expected dimensional region (subtle-wrongness guards specific
//      to each archetype)
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES, buildArchetypeProfile } from '../scripts/run-rec.mjs';
import { match } from '../src/match.mjs';
import { extractDimIds } from '../src/validate-profile.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'seed-game-profiles.json');
const DIMS_PATH = resolve(__dirname, '..', 'data', 'dimensions.json');

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
const seedById = new Map(seed.profiles.map(p => [p.game_id, p]));
const dimIds = extractDimIds(JSON.parse(readFileSync(DIMS_PATH, 'utf8')));

const ARCHETYPE_NAMES = [
  'heavy-strategist', 'party-extravert', 'coop-puzzler',
  'high-killer', 'narrative-seeker', 'casual-family',
  'kids-evening', 'drinking-game-night',
];

// ----------------------------------------------------------------------------
// Structural tests: every archetype is well-formed
// ----------------------------------------------------------------------------

test('ARCHETYPES contains all 8 expected names', () => {
  for (const name of ARCHETYPE_NAMES) {
    assert.ok(ARCHETYPES[name], `missing archetype: ${name}`);
    assert.ok(ARCHETYPES[name].label, `${name} missing label`);
    assert.ok(ARCHETYPES[name].dim_vector, `${name} missing dim_vector`);
  }
});

test('every archetype has all 24 required dimensions', () => {
  for (const name of ARCHETYPE_NAMES) {
    const dv = ARCHETYPES[name].dim_vector;
    for (const id of dimIds) {
      assert.ok(id in dv, `archetype ${name} missing dim: ${id}`);
    }
  }
});

test('every archetype has dim values in [-1, 1]', () => {
  for (const name of ARCHETYPE_NAMES) {
    const dv = ARCHETYPES[name].dim_vector;
    for (const [id, v] of Object.entries(dv)) {
      assert.ok(typeof v === 'number' && Number.isFinite(v),
        `archetype ${name} dim ${id} not a finite number: ${v}`);
      assert.ok(v >= -1 && v <= 1,
        `archetype ${name} dim ${id} out of range: ${v}`);
    }
  }
});

test('buildArchetypeProfile produces matcher-compatible shape', () => {
  for (const name of ARCHETYPE_NAMES) {
    const profile = buildArchetypeProfile(name);
    assert.ok(profile.label);
    assert.ok(profile.dim_vector);
    assert.ok(profile.confidence_vector);
    // confidence_vector should mirror dim_vector keys
    assert.deepEqual(
      Object.keys(profile.dim_vector).sort(),
      Object.keys(profile.confidence_vector).sort(),
      `archetype ${name}: confidence keys don't match dim keys`
    );
    // confidence values should all be in [0, 1]
    for (const [id, c] of Object.entries(profile.confidence_vector)) {
      assert.ok(c >= 0 && c <= 1, `archetype ${name} confidence ${id} out of range: ${c}`);
    }
  }
});

test('buildArchetypeProfile throws on unknown name', () => {
  assert.throws(
    () => buildArchetypeProfile('nonexistent-archetype'),
    /Unknown archetype/
  );
});

// ----------------------------------------------------------------------------
// SUBTLE-WRONGNESS: each archetype's #1 must be in its expected region
// ----------------------------------------------------------------------------

function topGameForArchetype(name) {
  const player = buildArchetypeProfile(name);
  const result = match(player, seed.profiles, { limit: 1, diversify: false });
  return seedById.get(result.recommendations[0].game_id);
}

test('SUBTLE-WRONGNESS: heavy-strategist #1 has high MEC_COMPLEXITY + MEC_STRATEGY', () => {
  const top = topGameForArchetype('heavy-strategist');
  assert.ok(top.dim_vector.MEC_COMPLEXITY >= 0.4,
    `${top.game_name}: MEC_COMPLEXITY too low (${top.dim_vector.MEC_COMPLEXITY})`);
  assert.ok(top.dim_vector.MEC_STRATEGY >= 0.6,
    `${top.game_name}: MEC_STRATEGY too low (${top.dim_vector.MEC_STRATEGY})`);
});

test('SUBTLE-WRONGNESS: party-extravert #1 has high PSY_SOCIAL or EMO_HUMOR + low MEC_COMPLEXITY', () => {
  const top = topGameForArchetype('party-extravert');
  assert.ok(top.dim_vector.MEC_COMPLEXITY <= -0.4,
    `${top.game_name}: MEC_COMPLEXITY too high (${top.dim_vector.MEC_COMPLEXITY})`);
  assert.ok(top.dim_vector.PSY_SOCIAL >= 0.5 || top.dim_vector.EMO_HUMOR >= 0.5,
    `${top.game_name}: not party-coded on PSY_SOCIAL or EMO_HUMOR`);
});

test('SUBTLE-WRONGNESS: coop-puzzler #1 is pure-coop (SOC_COOP_COMP <= -0.5)', () => {
  const top = topGameForArchetype('coop-puzzler');
  assert.ok(top.dim_vector.SOC_COOP_COMP <= -0.5,
    `${top.game_name}: not pure-coop (SOC_COOP_COMP=${top.dim_vector.SOC_COOP_COMP})`);
});

test('SUBTLE-WRONGNESS: high-killer #1 has high PSY_KILLER + competitive', () => {
  const top = topGameForArchetype('high-killer');
  assert.ok(top.dim_vector.PSY_KILLER >= 0.5,
    `${top.game_name}: PSY_KILLER too low (${top.dim_vector.PSY_KILLER}); high-killer should match aggressive games`);
  assert.ok(top.dim_vector.SOC_COOP_COMP >= 0.5,
    `${top.game_name}: not competitive enough (SOC_COOP_COMP=${top.dim_vector.SOC_COOP_COMP})`);
});

test('SUBTLE-WRONGNESS: narrative-seeker #1 has high AES_NARRATIVE', () => {
  const top = topGameForArchetype('narrative-seeker');
  assert.ok(top.dim_vector.AES_NARRATIVE >= 0.5,
    `${top.game_name}: AES_NARRATIVE too low (${top.dim_vector.AES_NARRATIVE}); narrative-seeker must get narrative-rich game`);
});

test('SUBTLE-WRONGNESS: casual-family #1 is light + low-conflict (low MEC_COMPLEXITY + low PSY_KILLER)', () => {
  const top = topGameForArchetype('casual-family');
  assert.ok(top.dim_vector.MEC_COMPLEXITY <= 0.0,
    `${top.game_name}: too heavy for casual-family (MEC_COMPLEXITY=${top.dim_vector.MEC_COMPLEXITY})`);
  assert.ok(top.dim_vector.PSY_KILLER <= -0.3,
    `${top.game_name}: too aggressive for casual-family (PSY_KILLER=${top.dim_vector.PSY_KILLER})`);
});

test('SUBTLE-WRONGNESS: kids-evening #1 is very light + extremely low PSY_KILLER', () => {
  const top = topGameForArchetype('kids-evening');
  assert.ok(top.dim_vector.MEC_COMPLEXITY <= -0.6,
    `${top.game_name}: too heavy for kids-evening (MEC_COMPLEXITY=${top.dim_vector.MEC_COMPLEXITY})`);
  assert.ok(top.dim_vector.PSY_KILLER <= -0.7,
    `${top.game_name}: too aggressive for kids-evening (PSY_KILLER=${top.dim_vector.PSY_KILLER})`);
});

test('SUBTLE-WRONGNESS: drinking-game-night #1 is very light + high EMO_HUMOR or PSY_SOCIAL', () => {
  const top = topGameForArchetype('drinking-game-night');
  assert.ok(top.dim_vector.MEC_COMPLEXITY <= -0.5,
    `${top.game_name}: too heavy for drinking-game-night (MEC_COMPLEXITY=${top.dim_vector.MEC_COMPLEXITY})`);
  assert.ok(top.dim_vector.EMO_HUMOR >= 0.4 || top.dim_vector.PSY_SOCIAL >= 0.7,
    `${top.game_name}: not party-coded enough for drinking-game-night`);
});

// ----------------------------------------------------------------------------
// CORRECTNESS-AT-A-DISTANCE: archetypes that should be DIMENSIONALLY OPPOSED
// should not produce overlapping top picks
// ----------------------------------------------------------------------------

test('archetype-vs-archetype: high-killer top != coop-puzzler top', () => {
  const killerTop = topGameForArchetype('high-killer');
  const coopTop = topGameForArchetype('coop-puzzler');
  assert.notEqual(killerTop.game_id, coopTop.game_id,
    `high-killer and coop-puzzler shouldn't share a top pick (${killerTop.game_name})`);
});

test('archetype-vs-archetype: kids-evening top != heavy-strategist top', () => {
  const kidsTop = topGameForArchetype('kids-evening');
  const stratTop = topGameForArchetype('heavy-strategist');
  assert.notEqual(kidsTop.game_id, stratTop.game_id,
    `kids-evening and heavy-strategist shouldn't share a top pick`);
});

test('archetype-vs-archetype: drinking-game-night top != narrative-seeker top', () => {
  const partyTop = topGameForArchetype('drinking-game-night');
  const narrTop = topGameForArchetype('narrative-seeker');
  assert.notEqual(partyTop.game_id, narrTop.game_id,
    `drinking-game-night and narrative-seeker shouldn't share a top pick`);
});
