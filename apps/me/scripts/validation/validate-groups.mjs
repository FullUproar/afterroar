// validate-groups.mjs
// ============================================================================
// Group rec validation. Tests the egalitarian (min) aggregation against
// the utilitarian (mean) trap by running the same group through both
// strategies and comparing the worst-case experience for each.
//
// Calls the orchestrator's primitives directly (canonical seidr matcher
// + game-meta + DB-loaded game profiles), no HTTP layer. Same code path
// as production for scoring + aggregation; just skips the API-key + JSON
// serialization round-trip the route does. Lets us run validation
// without provisioning an API key for the test harness.
//
// Usage:
//   DATABASE_URL=... node scripts/validation/validate-groups.mjs
//   DATABASE_URL=... node scripts/validation/validate-groups.mjs --report=tmp/groups.md
//
// Note: this does NOT need the API key, does NOT need the personas
// seeded to DB (we use the in-memory persona profiles directly), and
// does NOT need a deployed prod environment — works against whatever
// DB the env points to.
// ============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { scoreAll, gameGameSimilarity } from '../../lib/heimdall/seidr-match.mjs';
import { PERSONAS } from './personas.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load gameMeta for the player-count filter. Path: scripts/validation/
// → ../../lib/heimdall/game-meta.json
const gameMeta = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', 'lib', 'heimdall', 'game-meta.json'), 'utf8'),
);

const TOP_K = 8;
// Same default as the orchestrator's recommendForGroup. Multiplicative
// boost factor; capped 0..1 on the per-anchor max similarity.
const AFFINITY_ALPHA = 0.5;

function personaById(id) {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown persona id: ${id}`);
  return p;
}

/**
 * Group scenarios. Each scenario is a named list of persona IDs and a
 * "claim" — the human-readable hypothesis the recs should support.
 *
 * Picked to span:
 *  - Strong overlap (same archetype, different sub-flavors): recs should be obvious
 *  - Mild conflict (adjacent archetypes): recs should find a comfortable middle
 *  - Hard conflict (opposing archetypes): the min/mean gap should be biggest here
 *  - Mixed-skill groups: family + heavy strategist forces compromise
 */
const SCENARIOS = [
  {
    id: 'all-family',
    name: 'All Family Players',
    members: ['family-player', 'family-player', 'family-player'],
    claim: 'A homogenous family group should land squarely in Family/Party subdomains, 30-75 min play time, low complexity.',
  },
  {
    id: 'wargamer-plus-family',
    name: 'Wargamer + Family Players',
    members: ['wargamer', 'family-player', 'family-player', 'family-player'],
    claim: 'Adding one wargamer to a family group should NOT recommend a heavy wargame under min aggregation. Mean aggregation will skew darker; min should protect the family.',
  },
  {
    id: 'strategist-plus-party',
    name: 'Heavy Strategist + Party Host',
    members: ['heavy-strategist', 'party-host'],
    claim: 'Maximally opposed tastes — min should find the rare game both tolerate (mid-weight + interactive); mean will pick polarizing mid-darkness games where one of them is miserable.',
  },
  {
    id: 'narrative-coop-trio',
    name: 'Narrative Co-op Trio',
    members: ['narrative-adventurer', 'narrative-adventurer', 'narrative-adventurer'],
    claim: 'Strong overlap — should produce campaign / story-driven recs (Gloomhaven, Marvel Champions, etc).',
  },
  {
    id: 'social-deduction-night',
    name: 'Social Deduction Night',
    members: ['social-deduction-fanatic', 'social-deduction-fanatic', 'party-host', 'family-player'],
    claim: 'Should converge on hidden-role / bluffing / large-group games. Family Player\'s presence keeps it from going pure-Werewolf.',
  },
  {
    id: 'opposites-test',
    name: 'Opposites: Strategist + Party Host + Roleplayer + Wargamer',
    members: ['heavy-strategist', 'party-host', 'roleplayer', 'wargamer'],
    claim: 'A "no good answer" group — designed to surface the trap clearly. Min should pick a tolerable middle; mean should produce something that polls 0.5 across all four (=miserable for all).',
  },
];

/** Load every active (not-superseded) seidr game profile from DB. */
async function loadGameProfilesFromDb(connStr) {
  const client = new pg.Client({ connectionString: connStr });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT game_id, dim_vector, confidence_per_dim FROM rec_seidr_game_profile WHERE NOT superseded',
    );
    return rows.map((r) => ({
      game_id: Number(r.game_id),
      dim_vector: r.dim_vector,
      confidence_per_dim: r.confidence_per_dim ?? undefined,
    }));
  } finally {
    await client.end();
  }
}

/**
 * Run group recs locally — same algorithm as
 * apps/me/lib/heimdall/orchestrator.ts:recommendForGroup, just inlined
 * here so the script doesn't have to deal with TypeScript / Next.js
 * runtime / `@/` path aliases.
 *
 * Steps:
 *   1. Filter games by player-count via gameMeta (group of 4 → 4-player games)
 *   2. For each persona, scoreAll(profile, candidates) → per-game cosine
 *   3. Aggregate per-game across personas (min and mean)
 *   4. Compute spread = max - min
 *   5. Sort by aggregate desc; tie-break on lower spread
 *   6. Return top-K
 */
function runGroupAggregation(profiles, gameProfiles, aggregation, playerCount, limit) {
  // Player-count filter via gameMeta — same as orchestrator.
  let candidates = gameProfiles;
  if (playerCount && playerCount > 0) {
    candidates = gameProfiles.filter((g) => {
      const m = gameMeta[String(g.game_id)];
      if (!m) return true;
      if (typeof m.minPlayers === 'number' && playerCount < m.minPlayers) return false;
      if (typeof m.maxPlayers === 'number' && playerCount > m.maxPlayers) return false;
      return true;
    });
  }

  // Score every candidate against every persona.
  // perGame: game_id → { personaIdx: score }
  const perGame = new Map();
  for (let i = 0; i < profiles.length; i++) {
    const persona = profiles[i];
    const scored = scoreAll(persona, candidates);
    for (const s of scored) {
      let m = perGame.get(s.game_id);
      if (!m) {
        m = new Map();
        perGame.set(s.game_id, m);
      }
      m.set(i, s.score);
    }
  }

  // Aggregate per-game.
  const aggregated = [];
  for (const [gameId, scoreMap] of perGame) {
    const scores = profiles.map((_, i) => scoreMap.get(i) ?? 0);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const aggregateScore = aggregation === 'mean' ? meanScore : minScore;
    aggregated.push({
      game_id: gameId,
      perPlayerScores: scores,
      groupAggregateScore: aggregateScore,
      scoreSpread: maxScore - minScore,
    });
  }

  // Sort: aggregate desc, tie-break on lower spread.
  aggregated.sort((a, b) => {
    if (b.groupAggregateScore !== a.groupAggregateScore) {
      return b.groupAggregateScore - a.groupAggregateScore;
    }
    return a.scoreSpread - b.scoreSpread;
  });

  return aggregated.slice(0, limit);
}

function fmtRec(r, idx, personaIds) {
  const meta = gameMeta[String(r.game_id)] || {};
  const name = meta.name || `Game #${r.game_id}`;
  const subdomain = meta.subdomain || '?';
  const time = typeof meta.playingTime === 'number' ? `${meta.playingTime}m` : '—';
  const perPlayer = r.perPlayerScores
    .map((score, i) => `${personaIds[i]}: ${score.toFixed(2)}`)
    .join(', ');
  return `  ${idx + 1}. ${name} (${meta.year || '?'}) [${subdomain}, ${time}]\n     agg=${r.groupAggregateScore.toFixed(3)} spread=${r.scoreSpread.toFixed(3)}  · ${perPlayer}`;
}

function compareAggregations(meanRecs, minRecs) {
  if (!meanRecs[0] || !minRecs[0]) return null;
  const meanTopWorst = Math.min(...meanRecs[0].perPlayerScores);
  const minTopWorst = Math.min(...minRecs[0].perPlayerScores);
  return {
    meanTopGameName: gameMeta[String(meanRecs[0].game_id)]?.name || `#${meanRecs[0].game_id}`,
    meanTopWorstPlayer: meanTopWorst,
    minTopGameName: gameMeta[String(minRecs[0].game_id)]?.name || `#${minRecs[0].game_id}`,
    minTopWorstPlayer: minTopWorst,
    floorGap: minTopWorst - meanTopWorst,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let reportPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--report=')) reportPath = args[i].slice('--report='.length);
    else if (args[i] === '--report') reportPath = args[++i];
  }

  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL env var required');

  process.stdout.write('Loading game profiles from DB… ');
  const gameProfiles = await loadGameProfilesFromDb(connStr);
  console.log(`${gameProfiles.length} active profiles loaded.`);
  console.log(`Validating ${SCENARIOS.length} group scenarios.\n`);

  const lines = [];
  lines.push(`# Group validation report`);
  lines.push('');
  lines.push(`Database: \`${connStr.split('@')[1]?.split('/')[0] || 'unknown'}\``);
  lines.push(`Game profiles considered: ${gameProfiles.length}`);
  lines.push(`Scenarios: ${SCENARIOS.length}`);
  lines.push(`Top-K per scenario: ${TOP_K}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## The case for egalitarian aggregation`);
  lines.push('');
  lines.push(`For each scenario we run BOTH \`min\` (egalitarian — worst-off player matters most) and \`mean\` (utilitarian — sum of fun) aggregations against the same group, and compare the worst-off player's score in the top rec under each. If our claim holds, \`min\` should produce a **higher** worst-case score than \`mean\` — especially in mixed-taste groups.`);
  lines.push('');
  lines.push('| Scenario | min top rec | min worst-player | mean top rec | mean worst-player | floor gap (min − mean) |');
  lines.push('|---|---|---|---|---|---|');

  const summaryRows = [];

  // Wrap each persona profile in seidr's expected shape (dim_vector +
  // optional confidence_vector). The matcher's `similarity` function
  // reads .confidence_vector from the player side.
  function asSeidrPlayer(persona) {
    return {
      dim_vector: persona.profile,
      confidence_vector: persona.confidence,
    };
  }

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name.padEnd(60)} `);
    try {
      const memberPersonas = scenario.members.map(personaById);
      // Deduplicate by id for the actual profiles list (a group of
      // [family, family, family] is one unique profile to score against
      // — three copies would just triple-count the same vector).
      const uniqueByid = new Map();
      for (const p of memberPersonas) uniqueByid.set(p.id, p);
      const uniquePersonas = Array.from(uniqueByid.values());
      const personaIds = uniquePersonas.map((p) => p.id);
      const profiles = uniquePersonas.map(asSeidrPlayer);
      const groupSize = memberPersonas.length;

      const minRecs = runGroupAggregation(profiles, gameProfiles, 'min', groupSize, TOP_K);
      const meanRecs = runGroupAggregation(profiles, gameProfiles, 'mean', groupSize, TOP_K);

      const cmp = compareAggregations(meanRecs, minRecs);
      if (cmp) {
        const floorGapStr = cmp.floorGap >= 0 ? `+${cmp.floorGap.toFixed(3)}` : cmp.floorGap.toFixed(3);
        const verdict = cmp.floorGap > 0.01 ? '✓' : (cmp.floorGap > -0.01 ? '~' : '✗');
        console.log(`${verdict}  min raises floor by ${floorGapStr}`);
        summaryRows.push({ scenario: scenario.name, ...cmp, verdict });
        lines.push(`| ${scenario.name} | ${cmp.minTopGameName} | ${cmp.minTopWorstPlayer.toFixed(3)} | ${cmp.meanTopGameName} | ${cmp.meanTopWorstPlayer.toFixed(3)} | ${verdict} ${floorGapStr} |`);
      } else {
        console.log('— no recs returned');
      }

      lines.push('');
      lines.push(`### ${scenario.name}`);
      lines.push('');
      lines.push(`**Members:** ${scenario.members.join(', ')}`);
      lines.push(`(${uniquePersonas.length} unique persona${uniquePersonas.length === 1 ? '' : 's'}, group size ${groupSize})`);
      lines.push('');
      lines.push(`**Claim:** ${scenario.claim}`);
      lines.push('');
      lines.push(`#### Top recs (min, egalitarian)`);
      lines.push('```');
      for (let i = 0; i < minRecs.length; i++) lines.push(fmtRec(minRecs[i], i, personaIds));
      lines.push('```');
      lines.push('');
      lines.push(`#### Top recs (mean, the trap)`);
      lines.push('```');
      for (let i = 0; i < meanRecs.length; i++) lines.push(fmtRec(meanRecs[i], i, personaIds));
      lines.push('```');
      lines.push('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ERROR: ${msg}`);
      lines.push(`### ${scenario.name} — ERROR`);
      lines.push(`\`\`\`\n${msg}\n\`\`\``);
      lines.push('');
    }
  }

  // Aggregate verdict.
  const validRows = summaryRows.filter((r) => Number.isFinite(r.floorGap));
  if (validRows.length > 0) {
    const avgGap = validRows.reduce((a, b) => a + b.floorGap, 0) / validRows.length;
    const wins = validRows.filter((r) => r.floorGap > 0.01).length;
    console.log('');
    console.log(`Aggregate: min raised the floor in ${wins}/${validRows.length} scenarios. Avg floor gap: ${avgGap >= 0 ? '+' : ''}${avgGap.toFixed(3)}`);
    lines.splice(11, 0, '', `**Aggregate result:** \`min\` raised the worst-player score in **${wins}/${validRows.length}** scenarios. Average floor gap (min − mean): **${avgGap >= 0 ? '+' : ''}${avgGap.toFixed(3)}**.`, '');
  }

  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, lines.join('\n'));
    console.log(`Report written to ${reportPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Group validation crashed:', err);
    process.exit(2);
  });
}
