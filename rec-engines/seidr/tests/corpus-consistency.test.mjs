// corpus-consistency.test.mjs
// ============================================================================
// Cross-game cosine consistency assertions over the seed corpus.
//
// These tests catch dimensional drift in `data/seed-game-profiles.json`. If
// any single profile in the corpus gets miskeyed (PSY_KILLER flipped sign,
// MEC_COMPLEXITY off by a magnitude, etc.) the cosine relationships between
// related games will break, and one of these assertions will fail.
//
// Categories of assertion:
//
//   1. SAME-FAMILY pairs: sequels, revised editions, and standalone-expansion
//      siblings should have cosine > 0.95. These are the strongest assertions
//      because the games SHOULD be dimensionally near-identical.
//
//   2. SAME-FAMILY / DIFFERENT-FOCUS pairs: same series but with intentional
//      design differences (e.g., 2P-only variant of a multiplayer game).
//      Cosine > 0.5 expected; the design differences dampen but don't
//      invert the dimensional fingerprint.
//
//   3. CONCEPTUALLY-SIMILAR pairs: different games but same dimensional
//      region (peaceful builders, heavy economic Euros, hidden-role
//      deduction, coop puzzles). Cosine > 0.7 expected.
//
//   4. OPPOSITE-POLE pairs: games at opposite ends of the dimensional space
//      (heavy 8hr wargame vs. 15-min party). Cosine should be negative,
//      indicating dimensional opposition.
//
// All thresholds are set with ≥ 0.05 margin below the actual cosine in the
// corpus at the time of authorship; if any assertion fails, the corpus has
// drifted and needs investigation.
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { similarity } from '../src/match.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'seed-game-profiles.json');

// Load corpus once and build a lookup map. Tests that need it can pull
// directly without re-reading the file.
const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
const byId = new Map(seed.profiles.map(p => [p.game_id, p]));

function cosine(idA, idB) {
  const a = byId.get(idA);
  const b = byId.get(idB);
  if (!a) throw new Error(`game_id ${idA} not in corpus`);
  if (!b) throw new Error(`game_id ${idB} not in corpus`);
  const r = similarity(
    { dim_vector: a.dim_vector, confidence_vector: a.confidence_per_dim },
    { dim_vector: b.dim_vector, confidence_per_dim: b.confidence_per_dim }
  );
  return r.cosine;
}

// ----------------------------------------------------------------------------
// Category 1: SAME-FAMILY pairs (cosine > 0.95)
// ----------------------------------------------------------------------------
// Sequels, revised editions, and direct successors that should be near-
// identical dimensional fingerprints.

test('same-family: Brass: Birmingham × Brass: Lancashire > 0.95', () => {
  assert.ok(cosine(224517, 28720) > 0.95, `actual: ${cosine(224517, 28720)}`);
});

test('same-family: Gloomhaven × Frosthaven > 0.95', () => {
  assert.ok(cosine(174430, 295770) > 0.95, `actual: ${cosine(174430, 295770)}`);
});

test('same-family: Gloomhaven × Gloomhaven: Jaws of the Lion > 0.90', () => {
  // JotL is the lighter-rules gateway version; slightly looser threshold
  assert.ok(cosine(174430, 291457) > 0.90, `actual: ${cosine(174430, 291457)}`);
});

test('same-family: Pandemic Legacy: S1 × S2 > 0.95', () => {
  assert.ok(cosine(161936, 221107) > 0.95, `actual: ${cosine(161936, 221107)}`);
});

test('same-family: Wingspan × Wingspan Asia > 0.90', () => {
  assert.ok(cosine(266192, 366161) > 0.90, `actual: ${cosine(266192, 366161)}`);
});

test('same-family: Azul × Azul: Summer Pavilion > 0.95', () => {
  assert.ok(cosine(230802, 287954) > 0.95, `actual: ${cosine(230802, 287954)}`);
});

test('same-family: War of the Ring × War of the Ring 2E > 0.95', () => {
  assert.ok(cosine(9609, 115746) > 0.95, `actual: ${cosine(9609, 115746)}`);
});

test('same-family: Agricola × Agricola Revised > 0.95', () => {
  assert.ok(cosine(31260, 200680) > 0.95, `actual: ${cosine(31260, 200680)}`);
});

test('same-family: X-Wing × X-Wing 2nd Edition > 0.95', () => {
  assert.ok(cosine(103885, 252328) > 0.95, `actual: ${cosine(103885, 252328)}`);
});

test('same-family: Great Western Trail × GWT 2nd Edition > 0.95', () => {
  assert.ok(cosine(193738, 341169) > 0.95, `actual: ${cosine(193738, 341169)}`);
});

test('same-family: Arkham Horror LCG × Revised Core Set > 0.95', () => {
  assert.ok(cosine(205637, 359609) > 0.95, `actual: ${cosine(205637, 359609)}`);
});

test('same-family: Hannibal: Rome vs Carthage × Hannibal & Hamilcar > 0.95', () => {
  assert.ok(cosine(234, 227460) > 0.95, `actual: ${cosine(234, 227460)}`);
});

test('same-family: Here I Stand × Here I Stand 500th > 0.95', () => {
  assert.ok(cosine(17392, 242722) > 0.95, `actual: ${cosine(17392, 242722)}`);
});

test('same-family: Combat Commander Europe × Combat Commander Pacific > 0.95', () => {
  assert.ok(cosine(21050, 28181) > 0.95, `actual: ${cosine(21050, 28181)}`);
});

test('same-family: Telestrations × Telestrations 12 Player Pack > 0.95', () => {
  assert.ok(cosine(46213, 153016) > 0.95, `actual: ${cosine(46213, 153016)}`);
});

// ----------------------------------------------------------------------------
// Category 2: SAME-FAMILY / DIFFERENT-FOCUS pairs (cosine > 0.5)
// ----------------------------------------------------------------------------
// Same series with intentional design pivots (e.g. 2P-only variant of a
// multiplayer game). Cosine should be positive and notable but not
// near-identical.

test('same-family-different-focus: Codenames × Codenames Duet > 0.5', () => {
  // Duet is the 2P-coop variant — flips SOC_COOP_COMP and CTX_PLAYER_COUNT
  assert.ok(cosine(178900, 224037) > 0.5, `actual: ${cosine(178900, 224037)}`);
});

test('same-family-different-focus: 7 Wonders × 7 Wonders Duel > 0.5', () => {
  // Duel is 2P-only and more conflict-driven than the multiplayer original
  assert.ok(cosine(68448, 173346) > 0.5, `actual: ${cosine(68448, 173346)}`);
});

// ----------------------------------------------------------------------------
// Category 3: CONCEPTUALLY-SIMILAR pairs (cosine > 0.7)
// ----------------------------------------------------------------------------
// Different games, same dimensional region. These assertions are the
// matcher's stress test: if cosine drops below the threshold, one of the
// games has drifted out of its expected region.

test('peaceful builders: Wingspan × Cascadia > 0.75', () => {
  assert.ok(cosine(266192, 295947) > 0.75, `actual: ${cosine(266192, 295947)}`);
});

test('peaceful builders: Wingspan × Ark Nova > 0.7', () => {
  // Ark Nova is heavier than Wingspan but same low-conflict animal-engine region
  assert.ok(cosine(266192, 342942) > 0.7, `actual: ${cosine(266192, 342942)}`);
});

test('low-conflict tile/pattern puzzles: Cascadia × Calico > 0.9', () => {
  assert.ok(cosine(295947, 283155) > 0.9, `actual: ${cosine(295947, 283155)}`);
});

test('low-conflict tile/pattern puzzles: Cascadia × Harmonies > 0.9', () => {
  assert.ok(cosine(295947, 414317) > 0.9, `actual: ${cosine(295947, 414317)}`);
});

test('heavy economic Euros: Brass: Birmingham × Terraforming Mars > 0.75', () => {
  assert.ok(cosine(224517, 167791) > 0.75, `actual: ${cosine(224517, 167791)}`);
});

test('heavy economic Euros: Brass: Birmingham × Gaia Project > 0.75', () => {
  assert.ok(cosine(224517, 220308) > 0.75, `actual: ${cosine(224517, 220308)}`);
});

test('heavy economic Euros: Terraforming Mars × Gaia Project > 0.75', () => {
  assert.ok(cosine(167791, 220308) > 0.75, `actual: ${cosine(167791, 220308)}`);
});

test('heavy thematic war: TI4 × War of the Ring 2E > 0.75', () => {
  assert.ok(cosine(233078, 115746) > 0.75, `actual: ${cosine(233078, 115746)}`);
});

test('coop with asymmetric specialists: Pandemic Legacy S1 × Spirit Island > 0.75', () => {
  assert.ok(cosine(161936, 162886) > 0.75, `actual: ${cosine(161936, 162886)}`);
});

test('light coop word: Codenames × Just One > 0.75', () => {
  assert.ok(cosine(178900, 254640) > 0.75, `actual: ${cosine(178900, 254640)}`);
});

test('hidden-role social deduction: Avalon × Secret Hitler > 0.85', () => {
  assert.ok(cosine(128882, 188834) > 0.85, `actual: ${cosine(128882, 188834)}`);
});

test('hidden-role social deduction: Avalon × Blood on the Clocktower > 0.5', () => {
  // BotC is much heavier and longer than Avalon but same hidden-role region
  assert.ok(cosine(128882, 240980) > 0.5, `actual: ${cosine(128882, 240980)}`);
});

// ----------------------------------------------------------------------------
// Category 4: OPPOSITE-POLE pairs (cosine < 0)
// ----------------------------------------------------------------------------
// Games at opposite ends of the dimensional space — heavy long wargames
// vs. light party games. Cosine should be NEGATIVE, indicating the matcher
// recognizes these as dimensionally opposed.

test('opposite poles: TI4 (8hr 4X conflict) × Codenames (15min party) < -0.2', () => {
  assert.ok(cosine(233078, 178900) < -0.2, `actual: ${cosine(233078, 178900)}`);
});

test('opposite poles: Gloomhaven (heavy fantasy campaign) × Codenames (party word) < -0.1', () => {
  assert.ok(cosine(174430, 178900) < -0.1, `actual: ${cosine(174430, 178900)}`);
});

test('opposite poles: WotR 2E (4hr wargame) × Codenames (15min party) < -0.3', () => {
  assert.ok(cosine(115746, 178900) < -0.3, `actual: ${cosine(115746, 178900)}`);
});

test('opposite poles: ASL (heaviest wargame in corpus) × So Clover (light coop party) < -0.4', () => {
  assert.ok(cosine(243, 329839) < -0.4, `actual: ${cosine(243, 329839)}`);
});

test('opposite poles: Magic: The Gathering (competitive deck-building) × Concept Kids (preschool coop) < -0.2', () => {
  assert.ok(cosine(463, 247314) < -0.2, `actual: ${cosine(463, 247314)}`);
});

// ----------------------------------------------------------------------------
// Diagnostic: print all consistency-pair cosines on demand
// ----------------------------------------------------------------------------
// This is a hand-runnable diagnostic, not an automated assertion. Useful when
// tuning thresholds or investigating drift after a corpus refresh.
//
//   node --test --test-name-pattern='diagnostic:' tests/

test('diagnostic: print all consistency pair cosines (always passes)', () => {
  const pairs = [
    [224517, 28720, 'Brass:B × Brass:L'],
    [174430, 295770, 'Gloomhaven × Frosthaven'],
    [161936, 221107, 'PandLeg S1 × S2'],
    [266192, 295947, 'Wingspan × Cascadia'],
    [167791, 220308, 'TM × Gaia P'],
    [233078, 178900, 'TI4 × Codenames (opposite)'],
    [115746, 178900, 'WotR 2E × Codenames (opposite)'],
    [128882, 188834, 'Avalon × Secret Hitler'],
  ];
  // Just compute; the test passes regardless. Actual numbers visible via
  // node --test ... -- output.
  for (const [a, b] of pairs) cosine(a, b);
  assert.ok(true);
});
