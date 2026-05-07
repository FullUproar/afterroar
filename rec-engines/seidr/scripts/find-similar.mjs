#!/usr/bin/env node
// scripts/find-similar.mjs
// ============================================================================
// CLI: find the games in the seed corpus most similar to a given game.
//
// Useful for:
//   - Debugging "why did the matcher recommend X for this player?"
//     (often: because game X is dimensionally close to a game the player loved)
//   - Sanity-checking the corpus ("are these dimensional clusters sensible?")
//   - Future "more like this" production feature seed
//
// Usage:
//   # Find 10 games most similar to Brass: Birmingham
//   node scripts/find-similar.mjs 224517
//
//   # More results
//   node scripts/find-similar.mjs 224517 --limit 20
//
//   # Use a different corpus (default: data/seed-game-profiles.json)
//   node scripts/find-similar.mjs 224517 --game-profiles path/to/other.json
//
//   # Show game names from BGG metadata (default: just BGG ids)
//   node scripts/find-similar.mjs 224517 --bgg-dir ../mimir/tests/fixtures/bgg
//
//   # JSON output for piping
//   node scripts/find-similar.mjs 224517 --json
//
// CLI flags:
//   <game_id>                positional, required
//   --limit <n>              top-K (default 10)
//   --game-profiles <path>   game profiles JSON (default: data/seed-game-profiles.json)
//   --bgg-dir <path>         optional BGG metadata for game-name display
//   --exclude <id,id,...>    additional game IDs to skip (source is always skipped)
//   --json                   output JSON instead of human-formatted text
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSimilarGames } from '../src/find-similar.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----------------------------------------------------------------------------
// Argument parsing
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    sourceGameId: null,
    gameProfiles: resolve(__dirname, '..', 'data', 'seed-game-profiles.json'),
    bggDir: null,
    exclude: [],
    limit: 10,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--game-profiles': args.gameProfiles = argv[++i]; break;
      case '--bgg-dir': args.bggDir = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      case '--exclude':
        args.exclude = argv[++i].split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => Number.isFinite(n));
        break;
      case '--json': args.json = true; break;
      default:
        // first non-flag arg is the source game id
        if (args.sourceGameId === null) {
          const id = parseInt(a, 10);
          if (!Number.isInteger(id)) {
            throw new Error(`Expected positional game_id, got: ${a}`);
          }
          args.sourceGameId = id;
        } else {
          throw new Error(`Unrecognized argument: ${a}`);
        }
    }
  }
  if (args.sourceGameId === null) {
    throw new Error('Source game_id required as positional argument');
  }
  return args;
}

// ----------------------------------------------------------------------------
// Loaders (same shape as run-rec.mjs)
// ----------------------------------------------------------------------------

function loadGameProfiles(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.profiles)) return raw.profiles;
  throw new Error(`${path}: not a flat array and no .profiles array`);
}

function loadBggNames(dir) {
  if (!dir || !existsSync(dir)) return null;
  const m = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const game = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (Number.isInteger(game.id) && typeof game.name === 'string') {
      m.set(game.id, game.name);
    }
  }
  return m;
}

// ----------------------------------------------------------------------------
// Output formatters
// ----------------------------------------------------------------------------

function formatHuman(result, gameNamesById) {
  const { source, recommendations } = result;
  const sourceName = (gameNamesById?.get(source.game_id))
    || source.game_name
    || `(BGG ${source.game_id})`;

  const lines = [];
  lines.push(``);
  lines.push(`=== Most similar to ${sourceName} (BGG ${source.game_id}) ===`);
  lines.push(``);
  recommendations.forEach((rec, idx) => {
    const name = (gameNamesById?.get(rec.game_id))
      || rec.profile.game_name
      || `(BGG ${rec.game_id})`;
    lines.push(`${idx + 1}. ${name} [BGG ${rec.game_id}]   cosine=${rec.cosine.toFixed(3)}`);
    if (rec.profile.narrative) {
      lines.push(`   ${rec.profile.narrative}`);
    }
    lines.push(``);
  });
  return lines.join('\n');
}

function formatJson(result, gameNamesById) {
  const { source, recommendations } = result;
  return JSON.stringify({
    source: {
      game_id: source.game_id,
      game_name: gameNamesById?.get(source.game_id) || source.game_name || null,
    },
    recommendations: recommendations.map(rec => ({
      game_id: rec.game_id,
      game_name: gameNamesById?.get(rec.game_id) || rec.profile.game_name || null,
      cosine: rec.cosine,
      narrative: rec.profile.narrative || null,
    })),
  }, null, 2);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profiles = loadGameProfiles(args.gameProfiles);
  const gameNamesById = loadBggNames(args.bggDir);

  const result = findSimilarGames(args.sourceGameId, profiles, {
    limit: args.limit,
    excludeGameIds: args.exclude,
  });

  if (args.json) {
    console.log(formatJson(result, gameNamesById));
  } else {
    console.log(formatHuman(result, gameNamesById));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error('find-similar.mjs failed:', err.message);
    process.exit(1);
  }
}
