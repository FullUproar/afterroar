#!/usr/bin/env node
// scripts/profile-game.mjs
// ============================================================================
// CLI wrapper for the game-profile generation pipeline.
//
// Reads BGG metadata JSON from disk, calls the LLM (via Anthropic SDK or a
// mock for offline runs), validates the response, and (when --apply is set)
// writes to rec_seidr_game_profile.
//
// The pipeline core (src/profile-game.mjs) is pure and testable; this script
// is the I/O layer that wires file reads + LLM client + DB writes together.
//
// Usage:
//   # Dry run with mock LLM (ships canned reference profiles -- useful for
//   # smoke-testing the pipeline glue without burning tokens)
//   node scripts/profile-game.mjs \
//     --bgg-dir ../mimir/tests/fixtures/bgg \
//     --mock
//
//   # Real run against Anthropic API for one game
//   ANTHROPIC_API_KEY=... node scripts/profile-game.mjs \
//     --bgg-file ../mimir/tests/fixtures/bgg/167791.json \
//     --model claude-sonnet-4-6
//
//   # Real run, write to DB
//   ANTHROPIC_API_KEY=... DATABASE_URL=postgres://... node scripts/profile-game.mjs \
//     --bgg-dir path/to/bgg/files \
//     --model claude-sonnet-4-6 \
//     --apply
//
// CLI flags:
//   --bgg-file <path>       single BGG JSON file (one game per file)
//   --bgg-dir <path>        directory of BGG JSON files (one game per file)
//   --bgg-bundle <path>     single JSON file containing an array of game
//                           objects (e.g. Manus's bgg-top25-bundle.json)
//   --dimensions <path>     dimensions.json path (default: ../data/dimensions.json)
//   --model <name>          model identifier (default: claude-sonnet-4-6)
//   --mock                  use the mock LLM that returns reference profiles
//   --apply                 write validated profiles to DB (otherwise prints)
//   --max-concurrent <n>    not yet implemented; currently always sequential
// ============================================================================

import { readdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  generateProfile,
  generateBatch,
  createMockLLMClient,
} from '../src/profile-game.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----------------------------------------------------------------------------
// Argument parsing (lightweight; full arg parser is overkill for this script)
// ----------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    bggFile: null,
    bggDir: null,
    bggBundle: null,
    dimensions: resolve(__dirname, '..', 'data', 'dimensions.json'),
    model: 'claude-sonnet-4-6',
    mock: false,
    apply: false,
    // Resumability: when true (default in --apply mode), pre-query DB
    // for existing game_ids and skip them. Set --no-skip-existing to
    // force-regenerate everything (rare; useful for testing).
    skipExisting: true,
    // Where to log per-game failures so a follow-up retry script can
    // pick them up. Default: tmp/failures-<timestamp>.json next to
    // the input bundle. Set --failure-log <path> to override.
    failureLog: null,
    // Progress logging cadence (every N games). Default 10 keeps the
    // log readable without spam.
    progressEvery: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--bgg-file': args.bggFile = argv[++i]; break;
      case '--bgg-dir': args.bggDir = argv[++i]; break;
      case '--bgg-bundle': args.bggBundle = argv[++i]; break;
      case '--dimensions': args.dimensions = argv[++i]; break;
      case '--model': args.model = argv[++i]; break;
      case '--mock': args.mock = true; break;
      case '--apply': args.apply = true; break;
      case '--no-skip-existing': args.skipExisting = false; break;
      case '--failure-log': args.failureLog = argv[++i]; break;
      case '--progress-every': args.progressEvery = Number(argv[++i]); break;
      default:
        throw new Error(`Unrecognized argument: ${a}`);
    }
  }
  return args;
}

/**
 * Load BGG metadata from one of three sources. Returns array of game objects.
 *
 * --bgg-file: single JSON file containing one game object
 * --bgg-dir: directory of JSON files, one game per file
 * --bgg-bundle: single JSON file containing an array of game objects
 *
 * Exactly one of the three must be set; this function throws on misuse.
 */
export function loadGames(args) {
  const sources = [args.bggFile, args.bggDir, args.bggBundle].filter(Boolean);
  if (sources.length === 0) {
    throw new Error('One of --bgg-file <path>, --bgg-dir <path>, or --bgg-bundle <path> is required');
  }
  if (sources.length > 1) {
    throw new Error('Specify only ONE of --bgg-file, --bgg-dir, --bgg-bundle');
  }

  if (args.bggFile) {
    return [JSON.parse(readFileSync(args.bggFile, 'utf8'))];
  }
  if (args.bggDir) {
    const files = readdirSync(args.bggDir).filter(f => f.endsWith('.json'));
    return files.map(f => JSON.parse(readFileSync(join(args.bggDir, f), 'utf8')));
  }
  // bgg-bundle: file is a single JSON array of game objects
  const raw = JSON.parse(readFileSync(args.bggBundle, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`--bgg-bundle file ${args.bggBundle} is not a JSON array (got ${typeof raw})`);
  }
  return raw;
}

// ----------------------------------------------------------------------------
// LLM clients
// ----------------------------------------------------------------------------

/**
 * Mock LLM client backed by data/reference-profiles.json. Looks up the
 * profile for the requested game_id and returns it as a JSON string.
 * Used for smoke-testing the pipeline without burning tokens.
 */
function buildReferenceMockClient() {
  const refPath = resolve(__dirname, '..', 'data', 'reference-profiles.json');
  const ref = JSON.parse(readFileSync(refPath, 'utf8'));
  const byId = new Map();
  for (const p of ref.profiles) {
    byId.set(p.game_id, p);
  }
  return createMockLLMClient(({ gameId }) => {
    const p = byId.get(gameId);
    if (!p) {
      throw new Error(`reference mock has no profile for game_id=${gameId}`);
    }
    // Reshape to the LLM-output contract (drop extra metadata, add stamps)
    return JSON.stringify({
      game_id: p.game_id,
      dim_vector: p.dim_vector,
      confidence_per_dim: p.confidence_per_dim,
      source_provenance: 'llm_generated',
      model_version: 'mock-reference',
      prompt_version: '1.0.0',
      narrative: p.narrative,
    });
  });
}

/**
 * Real Anthropic SDK client. Lazy-imports @anthropic-ai/sdk so the rest of
 * the pipeline runs without it installed.
 */
async function buildAnthropicClient(modelName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env var required for non-mock runs');
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  return {
    generate: async (prompt) => {
      const response = await client.messages.create({
        model: modelName,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      // pull text from the first text block
      const block = response.content.find(b => b.type === 'text');
      if (!block) {
        throw new Error('Anthropic response had no text block');
      }
      return block.text;
    },
  };
}

// ----------------------------------------------------------------------------
// Apply-to-DB layer (only invoked when --apply is set)
// ----------------------------------------------------------------------------
//
// Design notes (post-incident, 2026-05-09):
//
// The previous version of this script accumulated all generated profiles
// in memory and wrote them at the very end via a single shared pg client.
// On a 2351-game run it did two things wrong:
//
//   1. Held the pg connection idle for ~5 hours while LLM calls churned;
//      the connection died (Neon idle TCP reset / "Connection terminated
//      unexpectedly") just as the end-of-run write started. ~1500
//      generated profiles were lost.
//   2. Kept burning Anthropic credits after the account hit zero balance
//      (37 in-flight games failed with "credit balance too low"). Should
//      have aborted on the first credit-out.
//
// New design:
//   - Resumable: pre-query the DB for game_ids that already have an
//     active profile and skip them. Restarts after partial runs are
//     cheap; idempotent.
//   - Incremental writes: each profile gets written to DB the moment
//     it's generated + validated. Open a fresh pg client per write
//     (latency adds ~50ms; eliminates idle-timeout class entirely).
//   - Abort on credit-out: catch the error from the LLM call; if it's
//     a credit-balance error, exit non-zero with a clear message.
//   - Progress logging every N games (default 10).
//   - Failure log: per-game failures are appended to a JSON-lines file
//     so a follow-up `--retry` workflow can target just the misses.
// ----------------------------------------------------------------------------

const CREDIT_OUT_MARKERS = [
  'credit balance is too low',
  'credit balance too low',
  'invalid_request_error',  // covers the broader class; we double-check below
];

function isCreditOutError(err) {
  const msg = String(err?.message || err || '');
  if (!msg) return false;
  // The first marker is sufficient + specific. The second/third are
  // sanity checks to catch wording drift.
  return msg.includes('credit balance is too low') ||
    msg.includes('credit balance too low');
}

/**
 * Pre-fetch game_ids with active (not-superseded) profiles already in DB.
 * Used to make --apply runs resumable: skip games we've already done.
 */
async function loadExistingGameIds(connStr) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT DISTINCT game_id FROM rec_seidr_game_profile WHERE NOT superseded',
    );
    return new Set(rows.map((r) => Number(r.game_id)));
  } finally {
    await client.end();
  }
}

/**
 * Write ONE profile to DB with its own short-lived pg connection.
 * Defeats Neon's idle-connection killer + simplifies error semantics
 * (one INSERT == one connection lifecycle == can't half-fail).
 */
async function writeOneProfile(profile, connStr) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO rec_seidr_game_profile
        (id, game_id, profile_version, dim_vector, confidence_per_dim,
         source_provenance, model_version, prompt_version)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7)
       ON CONFLICT (game_id, profile_version) DO UPDATE SET
         dim_vector = EXCLUDED.dim_vector,
         confidence_per_dim = EXCLUDED.confidence_per_dim,
         source_provenance = EXCLUDED.source_provenance,
         model_version = EXCLUDED.model_version,
         prompt_version = EXCLUDED.prompt_version`,
      [
        profile.game_id * 1000 + 1,
        profile.game_id,
        profile.dim_vector,
        profile.confidence_per_dim,
        profile.source_provenance,
        profile.model_version || null,
        profile.prompt_version || null,
      ],
    );
  } finally {
    await client.end();
  }
}

/**
 * Append one failure record to the JSON-lines failure log so a follow-up
 * retry can target just the missing games. Best-effort — log failures
 * shouldn't break the main loop.
 */
function appendFailure(logPath, record) {
  if (!logPath) return;
  try {
    appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');
  } catch {}
}

function deriveFailureLogPath(args) {
  if (args.failureLog) return args.failureLog;
  // Default: tmp/profile-failures-<timestamp>.jsonl next to the input.
  const inputBase = args.bggBundle || args.bggDir || args.bggFile || 'profile-failures';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tmpDir = resolve(__dirname, '..', '..', 'mimir', 'tmp');
  return join(tmpDir, `profile-failures-${stamp}.jsonl`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Load dimensions
  const dimensions = JSON.parse(readFileSync(args.dimensions, 'utf8'));

  // Load BGG metadata into an array of game objects (loadGames enforces
  // exactly-one-source and validates bundle shape)
  const allGames = loadGames(args);
  console.log(`Loaded ${allGames.length} game(s) for profiling.`);

  // Build LLM client
  const llmClient = args.mock
    ? buildReferenceMockClient()
    : await buildAnthropicClient(args.model);
  console.log(args.mock ? 'Using mock LLM (reference profiles).' : `Using Anthropic ${args.model}.`);

  // Two paths: --apply (resilient incremental loop) vs dry-run (in-memory
  // batch via the original generateBatch helper, prints to stdout).

  if (!args.apply) {
    // Dry-run path: keep the original behavior (cheap, useful for offline
    // smoke tests). No DB writes; uses generateBatch directly.
    const { ok, failed } = await generateBatch(allGames, dimensions, llmClient, {
      modelVersionTag: args.mock ? 'mock-reference' : args.model,
    });
    console.log(`Generated ${ok.length} valid profile(s); ${failed.length} failure(s).`);
    for (const f of failed) console.log(`  ✗ ${f.game_id} (${f.name}): ${f.error}`);
    for (const p of ok) {
      console.log(`\n--- profile for game_id=${p.game_id} ---`);
      console.log(JSON.stringify(p, null, 2));
    }
    return;
  }

  // ---- --apply path: resumable, incremental, credit-aware -----------------

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL env var required for --apply');
  }

  const failureLogPath = deriveFailureLogPath(args);
  console.log(`Failure log: ${failureLogPath}`);

  // Resumability: skip games that already have an active profile.
  let games = allGames;
  if (args.skipExisting) {
    process.stdout.write(`Querying existing rec_seidr_game_profile rows… `);
    const existing = await loadExistingGameIds(connStr);
    console.log(`found ${existing.size}.`);
    games = allGames.filter((g) => !existing.has(g.id));
    console.log(`Skipping ${allGames.length - games.length} game(s) already in DB. ${games.length} remaining.`);
  }

  if (games.length === 0) {
    console.log('Nothing to do. Exiting.');
    return;
  }

  const startedAt = Date.now();
  let written = 0;
  let validationFailures = 0;
  let llmFailures = 0;
  let writeFailures = 0;
  const modelVersionTag = args.mock ? 'mock-reference' : args.model;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];

    // Generation step. Catches per-game errors so one bad LLM response
    // doesn't abort the whole run — except credit-out, which we treat as
    // a hard stop (every subsequent call will fail the same way).
    let profile;
    try {
      profile = await generateProfile(game, dimensions, llmClient, { modelVersionTag });
    } catch (err) {
      const msg = err?.message || String(err);
      const isCredit = isCreditOutError(err);
      const isValidation = msg.startsWith('generateProfile: validation failed');

      if (isValidation) validationFailures++;
      else llmFailures++;

      appendFailure(failureLogPath, {
        kind: isCredit ? 'credit_out' : (isValidation ? 'validation' : 'llm_call'),
        game_id: game.id,
        game_name: game.name,
        error: msg,
        at: new Date().toISOString(),
      });

      if (isCredit) {
        console.error(`\n⛔ Anthropic credits exhausted at game ${i + 1}/${games.length} (${game.id} — ${game.name}).`);
        console.error(`Top up at https://console.anthropic.com/settings/billing and re-run; the script is resumable + will skip everything already written.`);
        console.error(`Wrote ${written} new profile(s) before stopping.`);
        process.exit(2);
      }

      // Non-fatal failure — log + move on.
      console.log(`  ✗ ${game.id} (${game.name}): ${msg.split('\n')[0]}`);
      // Fall through to the progress-log block below.
    }

    // Write step. Each write opens its own short-lived pg connection so
    // we never carry an idle connection across the next LLM call.
    if (profile) {
      try {
        await writeOneProfile(profile, connStr);
        written++;
      } catch (err) {
        writeFailures++;
        const msg = err?.message || String(err);
        console.log(`  ✗ ${game.id} (${game.name}): write failed — ${msg.split('\n')[0]}`);
        appendFailure(failureLogPath, {
          kind: 'write',
          game_id: game.id,
          game_name: game.name,
          error: msg,
          at: new Date().toISOString(),
        });
      }
    }

    if ((i + 1) % args.progressEvery === 0 || i === games.length - 1) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = games.length - (i + 1);
      const etaMin = remaining > 0 && rate > 0 ? Math.round(remaining / rate / 60) : 0;
      console.log(
        `[${i + 1}/${games.length}] written=${written} ` +
          `validation_fails=${validationFailures} llm_fails=${llmFailures} write_fails=${writeFailures} ` +
          `· ${rate.toFixed(2)} games/s · ETA ~${etaMin}m`,
      );
    }
  }

  const totalMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(`\nDone in ${totalMin}m. Wrote ${written}/${games.length} profiles to rec_seidr_game_profile.`);
  console.log(`Failures: validation=${validationFailures}, llm=${llmFailures}, write=${writeFailures}.`);
  if (validationFailures + llmFailures + writeFailures > 0) {
    console.log(`See ${failureLogPath} for per-game details (re-run with --bgg-bundle pointed at a filtered list to retry).`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('profile-game.mjs failed:', err.message);
    process.exit(1);
  });
}
