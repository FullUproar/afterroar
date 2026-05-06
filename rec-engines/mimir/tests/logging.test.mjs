// logging.test.mjs
// ============================================================================
// Tests for the logging helpers. Pure shape assertions.
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequestLogRow,
  buildCandidateLogRows,
  buildFeedbackLogRow,
  buildRecapOutcomeRow,
  isValidOutcome,
  VALID_OUTCOMES,
} from '../src/logging.mjs';

// ----------------------------------------------------------------------------
// VALID_OUTCOMES / isValidOutcome
// ----------------------------------------------------------------------------

test('VALID_OUTCOMES: contains all 8 design-doc outcomes', () => {
  const expected = [
    'shown',
    'clicked',
    'accepted',
    'played',
    'rated',
    'bought',
    'dismissed',
    'ignored',
  ];
  assert.deepEqual(VALID_OUTCOMES.slice().sort(), expected.slice().sort());
});

test('isValidOutcome: accepts valid outcomes', () => {
  for (const o of VALID_OUTCOMES) {
    assert.equal(isValidOutcome(o), true, `Expected ${o} valid`);
  }
});

test('isValidOutcome: rejects invalid outcomes', () => {
  assert.equal(isValidOutcome('viewed'), false);
  assert.equal(isValidOutcome(''), false);
  assert.equal(isValidOutcome(null), false);
  assert.equal(isValidOutcome('SHOWN'), false); // case-sensitive
});

// ----------------------------------------------------------------------------
// buildRequestLogRow
// ----------------------------------------------------------------------------

test('buildRequestLogRow: copies request_id and ranker_version from response', () => {
  const request = {
    surface: 'hq_picker',
    caller: { player_id: 'p1' },
    context: { seed_loved: [100] },
    options: { limit: 5 },
  };
  const response = {
    request_id: 'rec-abc-123',
    ranker_version: 'mimir-content-similarity-0.1',
    results: [],
  };
  const row = buildRequestLogRow(request, response);
  assert.equal(row.request_id, 'rec-abc-123');
  assert.equal(row.ranker_version, 'mimir-content-similarity-0.1');
});

test('buildRequestLogRow: copies surface, caller, context, options', () => {
  const request = {
    surface: 'passport_library',
    caller: { player_id: 'p1', group_id: 'g1' },
    context: { seed_loved: [100], minutes_available: 60 },
    options: { limit: 10, explain: 'rich' },
  };
  const response = { request_id: 'r', ranker_version: 'v' };
  const row = buildRequestLogRow(request, response);
  assert.equal(row.surface, 'passport_library');
  assert.deepEqual(row.caller, { player_id: 'p1', group_id: 'g1' });
  assert.deepEqual(row.context, { seed_loved: [100], minutes_available: 60 });
  assert.deepEqual(row.options, { limit: 10, explain: 'rich' });
});

test('buildRequestLogRow: defaults missing fields gracefully', () => {
  const row = buildRequestLogRow({}, { request_id: 'r', ranker_version: 'v' });
  assert.equal(row.surface, 'unknown');
  assert.deepEqual(row.caller, {});
  assert.deepEqual(row.context, {});
  assert.deepEqual(row.options, {});
});

test('buildRequestLogRow: ts is ISO string by default; can be overridden', () => {
  const row1 = buildRequestLogRow({}, { request_id: 'r', ranker_version: 'v' });
  // ISO 8601 with millis: 2026-05-06T...Z
  assert.match(row1.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

  const fixed = '2026-05-06T12:00:00.000Z';
  const row2 = buildRequestLogRow({}, { request_id: 'r', ranker_version: 'v' }, { ts: fixed });
  assert.equal(row2.ts, fixed);
});

// ----------------------------------------------------------------------------
// buildCandidateLogRows
// ----------------------------------------------------------------------------

test('buildCandidateLogRows: accepts ranker output shape ({candidate, ...})', () => {
  const ranked = [
    {
      candidate: { id: 100, name: 'A' },
      score: 5.5,
      confidence: 0.8,
      reasonCodes: ['mechanic_match'],
      breakdown: { mechanicOverlap: 1.5 },
    },
    {
      candidate: { id: 200, name: 'B' },
      score: 3.2,
      confidence: 0.7,
      reasonCodes: ['weight_match'],
      breakdown: { weightSimilarity: 0.5 },
    },
  ];
  const rows = buildCandidateLogRows('req-1', ranked);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].request_id, 'req-1');
  assert.equal(rows[0].game_id, 100);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].score, 5.5);
  assert.equal(rows[0].confidence, 0.8);
  assert.deepEqual(rows[0].reason_codes, ['mechanic_match']);
  assert.deepEqual(rows[0].score_breakdown, { mechanicOverlap: 1.5 });
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].game_id, 200);
});

test('buildCandidateLogRows: accepts recommend() results shape', () => {
  const results = [
    {
      game_id: 100,
      game_name: 'A',
      score: 5.5,
      confidence: 0.8,
      explanation: {
        reason_codes: ['mechanic_match'],
        natural_language: 'Shares X with games you loved.',
      },
      diagnostics: {
        candidate_rank: 1,
        score_breakdown: { mechanicOverlap: 1.5 },
      },
    },
  ];
  const rows = buildCandidateLogRows('req-2', results);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].game_id, 100);
  assert.deepEqual(rows[0].reason_codes, ['mechanic_match']);
  assert.deepEqual(rows[0].score_breakdown, { mechanicOverlap: 1.5 });
});

test('buildCandidateLogRows: handles missing optional fields (recommend short response)', () => {
  const results = [
    {
      game_id: 100,
      game_name: 'A',
      score: 5.5,
      confidence: 0.8,
      explanation: {
        reason_codes: ['mechanic_match'],
        natural_language: '...',
      },
      // no diagnostics (explain='short' or 'long')
    },
  ];
  const rows = buildCandidateLogRows('req-3', results);
  assert.equal(rows[0].score_breakdown, null);
});

test('buildCandidateLogRows: assigns ranks 1..N in order', () => {
  const ranked = [{ candidate: { id: 1 } }, { candidate: { id: 2 } }, { candidate: { id: 3 } }];
  const rows = buildCandidateLogRows('r', ranked);
  assert.deepEqual(
    rows.map(r => r.rank),
    [1, 2, 3]
  );
});

test('buildCandidateLogRows: empty input returns []', () => {
  assert.deepEqual(buildCandidateLogRows('r', []), []);
  assert.deepEqual(buildCandidateLogRows('r', null), []);
  assert.deepEqual(buildCandidateLogRows('r', undefined), []);
});

// ----------------------------------------------------------------------------
// buildFeedbackLogRow
// ----------------------------------------------------------------------------

test('buildFeedbackLogRow: builds row with required fields', () => {
  const row = buildFeedbackLogRow('req-1', 100, 'played');
  assert.equal(row.request_id, 'req-1');
  assert.equal(row.game_id, 100);
  assert.equal(row.outcome, 'played');
  assert.equal(row.outcome_value, null);
  assert.equal(row.outcome_context, null);
  assert.match(row.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('buildFeedbackLogRow: includes outcome_value when provided', () => {
  const row = buildFeedbackLogRow('req-1', 100, 'rated', { outcome_value: 4 });
  assert.equal(row.outcome_value, 4);
});

test('buildFeedbackLogRow: includes outcome_context when provided', () => {
  const row = buildFeedbackLogRow('req-1', 100, 'bought', {
    outcome_value: 4500, // cents
    outcome_context: { store_id: 'store-1' },
  });
  assert.equal(row.outcome_value, 4500);
  assert.deepEqual(row.outcome_context, { store_id: 'store-1' });
});

test('buildFeedbackLogRow: throws on invalid outcome', () => {
  assert.throws(
    () => buildFeedbackLogRow('req-1', 100, 'wishlisted'),
    /Invalid feedback outcome/
  );
});

test('buildFeedbackLogRow: ts can be overridden', () => {
  const fixed = '2026-05-06T15:00:00.000Z';
  const row = buildFeedbackLogRow('req-1', 100, 'shown', { ts: fixed });
  assert.equal(row.ts, fixed);
});

// ----------------------------------------------------------------------------
// buildRecapOutcomeRow
// ----------------------------------------------------------------------------

test('buildRecapOutcomeRow: builds row with required fields', () => {
  const row = buildRecapOutcomeRow({
    night_id: 1,
    game_id: 100,
    player_id: 50,
  });
  assert.equal(row.night_id, 1);
  assert.equal(row.game_id, 100);
  assert.equal(row.player_id, 50);
  assert.equal(row.fun_rating, null);
  assert.equal(row.would_play_again, null);
  assert.equal(row.finished, null);
  assert.equal(row.won, null);
  assert.equal(row.notes, null);
});

test('buildRecapOutcomeRow: preserves all optional fields when provided', () => {
  const row = buildRecapOutcomeRow({
    night_id: 1,
    game_id: 100,
    player_id: 50,
    fun_rating: 4,
    would_play_again: true,
    finished: true,
    won: false,
    notes: 'Brad got salty',
  });
  assert.equal(row.fun_rating, 4);
  assert.equal(row.would_play_again, true);
  assert.equal(row.finished, true);
  assert.equal(row.won, false);
  assert.equal(row.notes, 'Brad got salty');
});

test('buildRecapOutcomeRow: throws when required fields missing', () => {
  assert.throws(() => buildRecapOutcomeRow({ night_id: 1, game_id: 100 }), /required/);
  assert.throws(() => buildRecapOutcomeRow({ night_id: 1, player_id: 50 }), /required/);
  assert.throws(() => buildRecapOutcomeRow({ game_id: 100, player_id: 50 }), /required/);
  assert.throws(() => buildRecapOutcomeRow(null), /required/);
});

test('buildRecapOutcomeRow: false / 0 are valid (not treated as missing)', () => {
  // night_id=0 is unusual but technically valid; should not throw
  // Actually: night_id 0 is falsy. Our guard uses == null, so 0 is fine.
  const row = buildRecapOutcomeRow({
    night_id: 0,
    game_id: 100,
    player_id: 0,
    fun_rating: 0,
    would_play_again: false,
    finished: false,
    won: false,
  });
  assert.equal(row.fun_rating, 0);
  assert.equal(row.won, false);
});
