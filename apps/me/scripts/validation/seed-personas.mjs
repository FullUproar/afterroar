// seed-personas.mjs
// ============================================================================
// Persists the validation personas to rec_seidr_player_profile so they
// can be referenced by passport_id from the group recs path. Idempotent:
// re-running updates the active row rather than appending profile_versions
// (test data shouldn't accrue version history — it's regenerated fresh
// each iteration).
//
// Test player IDs are prefixed `validate-test-` so they're trivially
// filterable from real Passport users. The notes column tags each row as
// `VALIDATION TEST PERSONA — auto-managed by scripts/validation/`.
//
// Usage:
//   DATABASE_URL=... node scripts/validation/seed-personas.mjs
//
// Companion: cleanup.mjs removes all `validate-test-%` rows when needed.
// ============================================================================

import pg from 'pg';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PERSONAS, dbPlayerIdFor, TEST_ID_PREFIX } from './personas.mjs';

const TEST_NOTES = 'VALIDATION TEST PERSONA — auto-managed by scripts/validation/';
const TEST_QUESTION_SET_VERSION = 'validation-test-personas-v1';

async function seedOnePersona(client, persona) {
  const playerId = dbPlayerIdFor(persona);
  // Use the supersede-by-update pattern: drop any existing rows for
  // this test player (cleanup is the right move since these are pure
  // test data — version history adds noise here), then insert v1.
  await client.query(
    `DELETE FROM rec_seidr_player_profile WHERE player_id = $1`,
    [playerId],
  );
  await client.query(
    `INSERT INTO rec_seidr_player_profile (
      player_id, profile_version, dim_vector, confidence_vector,
      question_set_version, questions_answered, source, notes
    ) VALUES (
      $1, 1, $2::jsonb, $3::jsonb, $4, $5, 'validation-test', $6
    )`,
    [
      playerId,
      JSON.stringify(persona.profile),
      JSON.stringify(persona.confidence),
      TEST_QUESTION_SET_VERSION,
      // questions_answered isn't meaningful for synthetic personas;
      // keep a sensible non-zero so any aggregate join stays sane.
      24,
      `${TEST_NOTES}\nPersona: ${persona.name}\n${persona.narrative}`,
    ],
  );
}

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL env var required');

  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    console.log(`Seeding ${PERSONAS.length} validation personas to rec_seidr_player_profile...`);
    for (const persona of PERSONAS) {
      await seedOnePersona(client, persona);
      console.log(`  ✓ ${dbPlayerIdFor(persona)}  (${persona.name})`);
    }

    // Sanity counts.
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM rec_seidr_player_profile WHERE player_id LIKE $1`,
      [`${TEST_ID_PREFIX}%`],
    );
    console.log(`\nTotal validation personas in DB: ${r.rows[0].n}`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}
