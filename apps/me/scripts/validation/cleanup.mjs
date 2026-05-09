// cleanup.mjs
// ============================================================================
// Removes all validation test rows from rec_seidr_* tables. Filters by
// the `validate-test-` prefix on player_id / passport_id — that prefix
// is enforced by personas.mjs:dbPlayerIdFor() so this catches every
// row written by seed-personas.mjs (and any rec events / signals that
// got created when test recs were run).
//
// Usage:
//   DATABASE_URL=... node scripts/validation/cleanup.mjs
//   DATABASE_URL=... node scripts/validation/cleanup.mjs --dry-run
//
// Safety: prints counts before deleting. --dry-run shows counts without
// touching anything.
// ============================================================================

import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { TEST_ID_PREFIX } from './personas.mjs';

const PREFIX_PATTERN = `${TEST_ID_PREFIX}%`;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL env var required');

  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    // Pre-count.
    const profileCount = (await client.query(
      `SELECT COUNT(*)::int AS n FROM rec_seidr_player_profile WHERE player_id LIKE $1`,
      [PREFIX_PATTERN],
    )).rows[0].n;
    const signalCount = (await client.query(
      `SELECT COUNT(*)::int AS n FROM rec_seidr_user_game_signal WHERE passport_id LIKE $1`,
      [PREFIX_PATTERN],
    )).rows[0].n;
    const eventCount = (await client.query(
      `SELECT COUNT(*)::int AS n FROM rec_seidr_recommendation_event WHERE passport_id LIKE $1`,
      [PREFIX_PATTERN],
    )).rows[0].n;

    console.log(`Validation test rows currently in DB:`);
    console.log(`  rec_seidr_player_profile:        ${profileCount}`);
    console.log(`  rec_seidr_user_game_signal:      ${signalCount}`);
    console.log(`  rec_seidr_recommendation_event:  ${eventCount}`);

    if (dryRun) {
      console.log('\n--dry-run: no changes made.');
      return;
    }

    // Delete in dependency order (signals + events reference no FK to
    // profile rows directly, but conceptually the profile is the root).
    await client.query(
      `DELETE FROM rec_seidr_user_game_signal WHERE passport_id LIKE $1`,
      [PREFIX_PATTERN],
    );
    await client.query(
      `DELETE FROM rec_seidr_recommendation_event WHERE passport_id LIKE $1`,
      [PREFIX_PATTERN],
    );
    await client.query(
      `DELETE FROM rec_seidr_player_profile WHERE player_id LIKE $1`,
      [PREFIX_PATTERN],
    );

    console.log(`\nDeleted ${profileCount + signalCount + eventCount} validation test rows.`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
  });
}
