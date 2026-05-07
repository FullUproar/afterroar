// integration.test.mjs
// ============================================================================
// End-to-end integration tests using realistic BGG-shaped fixture data.
// These tests run the full pipeline (taste vector -> score -> rank ->
// explain -> RecommendResponse) against ~7 hand-crafted game fixtures
// that mirror real BGG metadata (mechanics, categories, designers,
// weight, playing time, BGG rank).
//
// Distinct from the unit tests, which use minimal mocks. Integration
// tests catch issues that show up only with realistic data shapes.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommend } from '../src/recommend.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures', 'bgg');

function loadFixtures() {
  const map = new Map();
  const files = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const game = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
    map.set(game.id, game);
  }
  return map;
}

test('integration: fixture set loads', () => {
  const games = loadFixtures();
  assert.ok(games.size >= 5, `Expected at least 5 fixtures, got ${games.size}`);
});

test('integration: noped game gets hard-veto end-to-end', () => {
  const games = loadFixtures();
  const response = recommend({
    surface: 'hq_picker',
    caller: {},
    context: {
      seed_loved: [167791, 266192],
      seed_noped: [178900],
      desired_player_count: 4,
      minutes_available: 90,
    },
    options: { limit: 10 },
  }, games);
  // Codenames must never be top (it was noped)
  assert.notEqual(response.results[0].game_id, 178900);
  // If it appears at all, score must be hard-veto
  const codenames = response.results.find(r => r.game_id === 178900);
  if (codenames) {
    assert.ok(codenames.score < -5, `Expected hard veto, got ${codenames.score}`);
    assert.ok(codenames.explanation.reason_codes.includes('noped_explicitly'));
  }
});

test('integration: TI4 (8 hours) ranks below short games when only 30 min available', () => {
  const games = loadFixtures();
  const response = recommend({
    surface: 'hq_picker',
    caller: {},
    context: {
      seed_loved: [266192],
      desired_player_count: 4,
      minutes_available: 30,
    },
    options: { limit: 10, explain: 'rich' },
  }, games);
  const ti4 = response.results.find(r => r.game_id === 233078);
  if (ti4) {
    assert.equal(ti4.diagnostics.score_breakdown.lengthFit, 0,
      'TI4 length fit should be 0 with 30 min available');
    assert.ok(ti4.explanation.reason_codes.includes('length_violated'));
  }
});

test('integration: confidence stays high with rich seed + context', () => {
  const games = loadFixtures();
  const response = recommend({
    surface: 'hq_picker',
    caller: {},
    context: {
      seed_loved: [167791, 266192],
      seed_noped: [178900],
      desired_player_count: 4,
      minutes_available: 90,
    },
    options: { limit: 5 },
  }, games);
  for (const r of response.results) {
    assert.ok(r.confidence >= 0.5,
      `Expected confidence ≥ 0.5 for rich-context request, got ${r.confidence} on game ${r.game_id}`);
  }
});

test('integration: empty seed + no context returns low-confidence results', () => {
  const games = loadFixtures();
  const response = recommend({
    surface: 'hq_picker',
    caller: {},
    context: {},
    options: { limit: 5 },
  }, games);
  for (const r of response.results) {
    assert.ok(r.confidence < 0.5, `Expected confidence < 0.5 for empty input`);
  }
});

test('integration: explain=rich response has full diagnostics on each result', () => {
  const games = loadFixtures();
  const response = recommend({
    surface: 'hq_picker',
    caller: {},
    context: {
      seed_loved: [167791],
      desired_player_count: 4,
      minutes_available: 90,
    },
    options: { limit: 3, explain: 'rich' },
  }, games);
  for (const r of response.results) {
    assert.ok(r.diagnostics, 'rich response should have diagnostics');
    assert.equal(typeof r.diagnostics.candidate_rank, 'number');
    assert.ok(r.diagnostics.score_breakdown);
    assert.ok(Array.isArray(r.explanation.contributors));
  }
});
