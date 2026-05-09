// seed-game-profiles.mjs
// ============================================================================
// Inserts the hand-authored seed corpus from data/seed-game-profiles.json
// into rec_seidr_game_profile. Idempotent: ON CONFLICT DO NOTHING on the
// (game_id, profile_version) combination.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/seed-game-profiles.mjs
//
// Why this is a script (not a SQL migration):
//   - Migrations enforce rec_* prefix only — reasonable.
//   - 225 rows of complex JSON are simpler to manage as data than embedded
//     SQL VALUES.
//   - Re-runnable without changing the migration history.
// ============================================================================

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DATA_PATH = join(__dirname, '..', 'data', 'seed-game-profiles.json');

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL env var required');

  // Allow alternate corpus file via --file <path> for staged additions
  // (e.g. the 25-game hand-authored extension on top of the 225 base).
  let dataPath = DEFAULT_DATA_PATH;
  const fileFlagIdx = process.argv.indexOf('--file');
  if (fileFlagIdx >= 0 && process.argv[fileFlagIdx + 1]) {
    dataPath = process.argv[fileFlagIdx + 1];
  }
  console.log('Reading corpus from:', dataPath);

  const corpus = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(corpus.profiles)) {
    throw new Error('seed-game-profiles.json missing "profiles" array');
  }

  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  console.log(`Seeding ${corpus.profiles.length} game profiles...`);

  let inserted = 0;
  let skipped = 0;
  try {
    for (const p of corpus.profiles) {
      // Insert is conditioned on (game_id, profile_version) uniqueness.
      // The schema has profile_version int default 1 and a unique index
      // on (game_id, profile_version) — confirm by trying ON CONFLICT.
      const result = await client.query(
        `INSERT INTO rec_seidr_game_profile
           (game_id, profile_version, dim_vector, confidence_per_dim,
            source_provenance, model_version, prompt_version, superseded)
         VALUES ($1, 1, $2::jsonb, $3::jsonb, $4, $5, $6, false)
         ON CONFLICT DO NOTHING`,
        [
          p.game_id,
          JSON.stringify(p.dim_vector),
          JSON.stringify(p.confidence_per_dim || {}),
          corpus.source_provenance ?? 'seed-corpus-v1',
          corpus.model_version ?? null,
          corpus.prompt_version ?? null,
        ],
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    }
  } finally {
    await client.end();
  }

  console.log(`Done. Inserted: ${inserted}, skipped (already present): ${skipped}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}
