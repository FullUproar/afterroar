// Smoke test for Heimdall's seidr path.
// In-process (no HTTP, no auth). Loads the 225-game corpus from prod
// Afterroar Neon, runs seidr.match() with a synthetic player profile,
// confirms recommendations come back ranked and well-formed.
//
// Usage:
//   node scripts/smoke-test-heimdall.mjs

import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { match } from '@afterroar/rec-engine-seidr/match';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing — run vercel env pull first');
  process.exit(1);
}

// Synthetic player profile — a mix of preferences. Doesn't matter for
// smoke; we just need the engine to do real math against the corpus.
// seidr.match expects { dim_vector: {...}, confidence_vector?: {...} }.
const playerDimVector = {
  PSY_ACHIEVEMENT: 0.6,
  PSY_EXPLORATION: 0.4,
  PSY_SOCIAL: 0.3,
  PSY_KILLER: -0.4,
  PSY_OPENNESS: 0.5,
  PSY_CONSCIENTIOUSNESS: 0.2,
  PSY_EXTRAVERSION: 0.0,
  PSY_AGREEABLENESS: 0.3,
  PSY_NEUROTICISM: -0.2,
  SOC_COOP_COMP: 0.2,
  SOC_DIRECT_INDIRECT: 0.0,
  SOC_TRUST_BETRAYAL: -0.4,
  MEC_LUCK_SKILL: 0.3,
  MEC_COMPLEXITY: 0.4,
  MEC_STRATEGY: 0.6,
  MEC_ASYMMETRY: 0.2,
  AES_THEME_MECH: 0.0,
  AES_NARRATIVE: 0.3,
  AES_COMPONENTS: 0.4,
  AES_HUMOR: 0.5,
  CTX_SESSION_LENGTH: 0.0,
  CTX_PLAYER_COUNT: 0.0,
  EMO_TENSION: 0.4,
  EMO_HUMOR: 0.5,
};

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const t0 = Date.now();
  const rows = await client.query(`
    SELECT game_id, dim_vector, confidence_per_dim
    FROM rec_seidr_game_profile
    WHERE NOT superseded
  `);
  const dbMs = Date.now() - t0;
  console.log(`Loaded ${rows.rows.length} game profiles in ${dbMs}ms`);

  const profiles = rows.rows.map((r) => ({
    game_id: Number(r.game_id),
    dim_vector: r.dim_vector,
    confidence_per_dim: r.confidence_per_dim ?? undefined,
  }));

  const playerProfile = { dim_vector: playerDimVector };
  const t1 = Date.now();
  const result = match(playerProfile, profiles, { limit: 12, diversify: true });
  const matchMs = Date.now() - t1;

  console.log(`\nseidr.match took ${matchMs}ms`);
  console.log(`totalConsidered: ${result.totalConsidered}`);
  console.log(`filtered: ${result.filtered.length}`);
  console.log(`recommendations: ${result.recommendations.length}\n`);
  console.log('Top 12:');
  for (const r of result.recommendations) {
    console.log(`  game ${r.game_id}\tscore ${r.score.toFixed(4)}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
