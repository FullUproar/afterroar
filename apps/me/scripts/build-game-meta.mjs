// Build apps/me/lib/heimdall/game-meta.json from the BGG dump.
//
// Source-of-truth for which IDs belong in the bundle:
//   - rec_seidr_game_profile (DB) — every game with an active, non-superseded
//     profile. This guarantees we never recommend a game whose name/year
//     we can't render. Whatever the engine knows about, the bundle covers.
//   - apps/me/lib/heimdall/game-names.json — supplementary fallback for
//     legacy IDs not in the DB (preserves hand-curated names if the DB
//     query returns nothing).
//
// Joins against:
//   - rec-engines/mimir/tmp/bgg_deep.json (BGG metadata for ~2600 games)
//
// Outputs:
//   apps/me/lib/heimdall/game-meta.json
//     { "<id>": { name, year, subdomain, categories, description, ...} }
//
// `subdomain` is the BGG top-level genre bucket (Strategy / Family /
// Party / Thematic / Wargame / Customizable / Children / Abstract).
// We pick the first non-"Overall" entry from bggSubdomains.
//
// `categories` is normalized to up to 3 strings (handles both string-
// array and {id, value}-object-array formats present in the dump).
//
// Run from apps/me/:
//   DATABASE_URL=postgres://... node scripts/build-game-meta.mjs
//
// (DATABASE_URL is REQUIRED so the script can pull the live ID set from
// rec_seidr_game_profile.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..', '..'); // ops-afterroar-store
const NAMES_PATH = path.join(__dirname, '..', 'lib', 'heimdall', 'game-names.json');
const META_PATH = path.join(__dirname, '..', 'lib', 'heimdall', 'game-meta.json');
const BGG_DUMP_PATH = path.join(REPO, 'rec-engines', 'mimir', 'tmp', 'bgg_deep.json');

function normCategories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && typeof c.value === 'string') return c.value;
      return null;
    })
    .filter((c) => c && c.length > 0);
}

function pickSubdomain(raw) {
  if (!Array.isArray(raw)) return null;
  // Skip 'Overall' — it's redundant. Take the first remaining entry.
  for (const s of raw) {
    if (typeof s !== 'string') continue;
    if (s === 'Overall') continue;
    // 'Strategy Games' → 'Strategy', etc.
    return s.replace(/\s+Games?$/i, '');
  }
  return null;
}

async function loadIdsFromDb() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL env var required (sources active game IDs from rec_seidr_game_profile)');
  }
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT DISTINCT game_id FROM rec_seidr_game_profile WHERE NOT superseded',
    );
    return rows.map((r) => Number(r.game_id));
  } finally {
    await client.end();
  }
}

async function main() {
  if (!fs.existsSync(BGG_DUMP_PATH)) {
    console.error('BGG dump not found at', BGG_DUMP_PATH);
    process.exit(1);
  }

  const dbIds = await loadIdsFromDb();
  // Merge: DB IDs (authoritative) ∪ legacy game-names.json IDs (fallback).
  // The union guarantees coverage even if a name was hand-added but never
  // got a profile in the DB yet.
  const namesFallback = fs.existsSync(NAMES_PATH)
    ? JSON.parse(fs.readFileSync(NAMES_PATH, 'utf8'))
    : {};
  const idSet = new Set(dbIds);
  for (const idStr of Object.keys(namesFallback)) idSet.add(Number(idStr));
  const allIds = [...idSet].sort((a, b) => a - b);
  console.log(`Sourcing ${allIds.length} IDs (${dbIds.length} from DB, ${Object.keys(namesFallback).length} from names fallback).`);

  const dump = JSON.parse(fs.readFileSync(BGG_DUMP_PATH, 'utf8'));
  const dumpById = new Map();
  for (const g of dump) dumpById.set(g.id, g);

  const meta = {};
  let withSubdomain = 0;
  let withCategories = 0;
  let withYear = 0;
  let missingInDump = 0;

  for (const id of allIds) {
    const idStr = String(id);
    const fallbackName = namesFallback[idStr];
    const g = dumpById.get(id);
    if (!g) {
      // Profile exists but BGG metadata is missing — keep whatever name
      // we have (fallback or a stub). The recommend route falls back to
      // "Game #ID" only when the meta entry itself is absent, so this
      // entry is enough to suppress that.
      meta[idStr] = { name: fallbackName || `Game #${id}` };
      missingInDump++;
      continue;
    }
    const subdomain = pickSubdomain(g.bggSubdomains);
    const categories = normCategories(g.categories).slice(0, 3);
    // Truncate description to a snippet — full BGG descriptions are
    // multi-paragraph and bloat the lookup. 400 chars is enough to
    // give a feel for the game in the info expander.
    const description = typeof g.description === 'string'
      ? g.description.replace(/\s+/g, ' ').trim().slice(0, 400)
      : null;
    const entry = {
      name: g.name || fallbackName || `Game #${id}`,
      year: typeof g.year === 'number' ? g.year : null,
      subdomain,
      categories,
      description,
      minPlayers: typeof g.minPlayers === 'number' ? g.minPlayers : null,
      maxPlayers: typeof g.maxPlayers === 'number' ? g.maxPlayers : null,
      playingTime: typeof g.playingTime === 'number' ? g.playingTime : null,
    };
    if (subdomain) withSubdomain++;
    if (categories.length) withCategories++;
    if (entry.year) withYear++;
    meta[idStr] = entry;
  }

  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  console.log(
    `Wrote ${Object.keys(meta).length} entries to game-meta.json:\n` +
      `  - ${withYear} with year\n` +
      `  - ${withSubdomain} with subdomain\n` +
      `  - ${withCategories} with at least one category\n` +
      `  - ${missingInDump} missing from dump (kept name only)`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
