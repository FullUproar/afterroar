#!/usr/bin/env node
// scripts/profile-diff.mjs
// ============================================================================
// CLI: compare two profile corpora (or two single profiles).
//
// Use cases:
//   - When you re-generate profiles via the LLM-API pipeline, diff against
//     the hand-authored seed corpus to see what shifted (calibration drift).
//   - When the seed corpus is updated, diff old-vs-new to audit before commit.
//
// Usage:
//   # Diff two corpus files
//   node scripts/profile-diff.mjs --from data/seed-game-profiles.json \
//     --to /path/to/new-profiles.json
//
//   # Single-game diff (each side a single-profile file)
//   node scripts/profile-diff.mjs --from old.json --to new.json --single
//
//   # Adjust drift threshold (default 0.15)
//   node scripts/profile-diff.mjs --from a.json --to b.json --threshold 0.25
//
//   # JSON output for piping
//   node scripts/profile-diff.mjs --from a.json --to b.json --json
//
// CLI flags:
//   --from <path>       baseline profiles JSON (required)
//   --to <path>         new profiles JSON (required)
//   --single            treat both files as single profiles (not arrays)
//   --threshold <n>     significant-delta threshold (default 0.15)
//   --json              JSON output instead of human-formatted
//   --top <n>           show only the top N most-drifted games (default 20)
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { diffProfile, diffCorpora } from '../src/profile-diff.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----------------------------------------------------------------------------
// Argument parsing
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    from: null,
    to: null,
    single: false,
    threshold: 0.15,
    json: false,
    top: 20,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--from': args.from = argv[++i]; break;
      case '--to': args.to = argv[++i]; break;
      case '--single': args.single = true; break;
      case '--threshold': args.threshold = parseFloat(argv[++i]); break;
      case '--json': args.json = true; break;
      case '--top': args.top = parseInt(argv[++i], 10); break;
      default:
        throw new Error(`Unrecognized argument: ${a}`);
    }
  }
  if (!args.from || !args.to) {
    throw new Error('Both --from <path> and --to <path> are required');
  }
  return args;
}

// ----------------------------------------------------------------------------
// Loaders (mirror run-rec.mjs / find-similar.mjs conventions)
// ----------------------------------------------------------------------------

function loadProfiles(path, asSingle) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (asSingle) {
    if (Array.isArray(raw)) {
      throw new Error(`${path}: --single specified but file is an array`);
    }
    return raw;
  }
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.profiles)) return raw.profiles;
  throw new Error(`${path}: not a flat array and no .profiles array`);
}

// ----------------------------------------------------------------------------
// Output formatters
// ----------------------------------------------------------------------------

function formatSingleHuman(diff) {
  const lines = [];
  lines.push(``);
  lines.push(`=== Profile diff for game_id ${diff.game_id} ===`);
  lines.push(``);
  lines.push(`L2 distance:        ${diff.l2_distance.toFixed(4)}`);
  lines.push(`Mean |delta|:       ${diff.mean_abs_delta.toFixed(4)}`);
  lines.push(`Max |delta|:        ${diff.max_abs_delta.toFixed(4)}`);
  lines.push(``);
  if (diff.significant_dims.length === 0) {
    lines.push(`No significant drift (all dims within threshold).`);
  } else {
    lines.push(`Significant drift on ${diff.significant_dims.length} dim(s):`);
    for (const s of diff.significant_dims) {
      const sign = s.delta >= 0 ? '+' : '';
      lines.push(`  ${s.dim.padEnd(28)} ${s.from.toFixed(2).padStart(6)} -> ${s.to.toFixed(2).padStart(6)}   (${sign}${s.delta.toFixed(2)})`);
    }
  }
  return lines.join('\n');
}

function formatCorpusHuman(result, top) {
  const lines = [];
  lines.push(``);
  lines.push(`=== Corpus diff summary ===`);
  lines.push(``);
  lines.push(`Games in both corpora:        ${result.summary.total_in_both}`);
  lines.push(`Only in --from (removed):     ${result.only_in_a.length}`);
  lines.push(`Only in --to (added):         ${result.only_in_b.length}`);
  lines.push(`Mean L2 distance:             ${result.summary.mean_l2_distance.toFixed(4)}`);
  lines.push(`Max L2 distance:              ${result.summary.max_l2_distance.toFixed(4)}`);
  lines.push(`Games with significant drift: ${result.summary.games_with_significant_drift} / ${result.summary.total_in_both}`);
  lines.push(``);

  if (result.only_in_a.length > 0) {
    lines.push(`Removed game_ids: ${result.only_in_a.slice(0, 10).join(', ')}${result.only_in_a.length > 10 ? ' ...' : ''}`);
  }
  if (result.only_in_b.length > 0) {
    lines.push(`Added game_ids:   ${result.only_in_b.slice(0, 10).join(', ')}${result.only_in_b.length > 10 ? ' ...' : ''}`);
  }

  lines.push(``);
  lines.push(`Top ${Math.min(top, result.diffs.length)} most-drifted games (by L2 distance):`);
  lines.push(``);
  for (const d of result.diffs.slice(0, top)) {
    const sigCount = d.significant_dims.length;
    const topDim = sigCount > 0 ? d.significant_dims[0] : null;
    const topDimStr = topDim
      ? `  worst: ${topDim.dim} (${topDim.from.toFixed(2)} -> ${topDim.to.toFixed(2)})`
      : '';
    lines.push(`  game ${String(d.game_id).padStart(7)}  L2=${d.l2_distance.toFixed(3)}  drift=${sigCount} dims${topDimStr}`);
  }

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fromData = loadProfiles(args.from, args.single);
  const toData = loadProfiles(args.to, args.single);

  if (args.single) {
    const diff = diffProfile(fromData, toData, { significantDelta: args.threshold });
    console.log(args.json ? JSON.stringify(diff, null, 2) : formatSingleHuman(diff));
    return;
  }

  const result = diffCorpora(fromData, toData, { significantDelta: args.threshold });
  if (args.json) {
    // Trim full per-dim deltas in JSON output to keep size manageable;
    // include them only for top-N drifted games
    const trimmed = {
      ...result,
      diffs: result.diffs.slice(0, args.top),
    };
    console.log(JSON.stringify(trimmed, null, 2));
  } else {
    console.log(formatCorpusHuman(result, args.top));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error('profile-diff.mjs failed:', err.message);
    process.exit(1);
  }
}
