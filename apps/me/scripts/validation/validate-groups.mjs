// validate-groups.mjs
// ============================================================================
// Group rec validation. Tests the egalitarian (min) aggregation against
// the utilitarian (mean) trap by running the same group through both
// strategies and comparing the worst-case experience for each.
//
// The case the report should make: for groups with conflicting tastes,
// `min` produces lists where the worst-off player is materially less
// miserable than under `mean`. If that gap shrinks, our claim is wrong;
// if it holds, we have evidence to point HQ at.
//
// Usage:
//   API_KEY=ar_live_... BASE_URL=https://www.afterroar.me \
//     node scripts/validation/validate-groups.mjs
//   API_KEY=ar_live_... node scripts/validation/validate-groups.mjs --report=tmp/groups.md
//
// Requires: validation personas seeded via seed-personas.mjs.
// Requires: API key with `recs:read` scope.
// ============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dbPlayerIdFor, PERSONAS } from './personas.mjs';

const DEFAULT_BASE_URL = 'https://www.afterroar.me';
const TOP_K = 8;

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

async function fetchGroupRecs(baseUrl, apiKey, playerIds, aggregation) {
  const res = await fetch(`${baseUrl}/api/recs/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      player_ids: playerIds,
      aggregation,
      limit: TOP_K,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function fmtRec(r, idx) {
  const subdomain = r.subdomain || '?';
  const time = typeof r.playing_time === 'number' ? `${r.playing_time}m` : '—';
  const perPlayer = (r.per_player_scores || [])
    .map((p) => `${p.playerId.replace('validate-test-', '')}: ${p.score.toFixed(2)}`)
    .join(', ');
  return `  ${idx + 1}. ${r.game_name} (${r.year || '?'}) [${subdomain}, ${time}]\n     agg=${r.group_aggregate_score.toFixed(3)} spread=${r.score_spread.toFixed(3)}  · ${perPlayer}`;
}

/**
 * Compare min-vs-mean for a scenario. Returns the gap analysis: under
 * mean aggregation, the top rec's MIN score (worst-off player); under
 * min aggregation, ditto. If our claim holds, min should produce a
 * higher worst-case in the top result.
 */
function compareAggregations(meanResp, minResp) {
  if (!meanResp.recommendations?.[0] || !minResp.recommendations?.[0]) return null;
  const meanTop = meanResp.recommendations[0];
  const minTop = minResp.recommendations[0];
  const meanTopWorstPlayer = Math.min(...meanTop.per_player_scores.map((p) => p.score));
  const minTopWorstPlayer = Math.min(...minTop.per_player_scores.map((p) => p.score));
  return {
    meanTopGameName: meanTop.game_name,
    meanTopWorstPlayer,
    minTopGameName: minTop.game_name,
    minTopWorstPlayer,
    floorGap: minTopWorstPlayer - meanTopWorstPlayer, // positive = min beats mean for the worst-off
  };
}

async function main() {
  const baseUrl = process.env.BASE_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('API_KEY env var required (api key with recs:read scope).');
    process.exit(2);
  }

  const args = process.argv.slice(2);
  let reportPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--report=')) reportPath = args[i].slice('--report='.length);
    else if (args[i] === '--report') reportPath = args[++i];
  }

  console.log(`Validating ${SCENARIOS.length} group scenarios against ${baseUrl}\n`);

  const lines = [];
  lines.push(`# Group validation report`);
  lines.push('');
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push(`Scenarios: ${SCENARIOS.length}`);
  lines.push(`Top-K per call: ${TOP_K}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## The case for egalitarian aggregation`);
  lines.push('');
  lines.push(`For each scenario we run BOTH \`min\` (egalitarian — worst-off player matters most) and \`mean\` (utilitarian — sum of fun) aggregations against the same group, and compare the worst-off player's score in the top rec under each. If our claim holds, \`min\` should produce a **higher** worst-case score than \`mean\` — especially in mixed-taste groups.`);
  lines.push('');
  lines.push('| Scenario | min top rec | min worst-player | mean top rec | mean worst-player | floor gap (min − mean) |');
  lines.push('|---|---|---|---|---|---|');

  const summaryRows = [];

  for (const scenario of SCENARIOS) {
    process.stdout.write(`  ${scenario.name.padEnd(50)} `);
    try {
      const playerIds = scenario.members.map((id) => dbPlayerIdFor(personaById(id)));
      // De-duplicate — group of [family, family, family] is still 1 unique
      // profile to load + score against. The aggregation behaves as if
      // the same player is at the table 3 times, which is still the right
      // model for "how many family-players are there" weighting.
      const uniqueIds = [...new Set(playerIds)];

      const minResp = await fetchGroupRecs(baseUrl, apiKey, uniqueIds, 'min');
      const meanResp = await fetchGroupRecs(baseUrl, apiKey, uniqueIds, 'mean');

      const cmp = compareAggregations(meanResp, minResp);
      if (cmp) {
        const floorGapStr = cmp.floorGap >= 0 ? `+${cmp.floorGap.toFixed(3)}` : cmp.floorGap.toFixed(3);
        const verdict = cmp.floorGap > 0.01 ? '✓' : (cmp.floorGap > -0.01 ? '~' : '✗');
        console.log(`${verdict}  min raises floor by ${floorGapStr}`);
        summaryRows.push({ scenario: scenario.name, ...cmp, verdict });
        lines.push(`| ${scenario.name} | ${cmp.minTopGameName} | ${cmp.minTopWorstPlayer.toFixed(3)} | ${cmp.meanTopGameName} | ${cmp.meanTopWorstPlayer.toFixed(3)} | ${verdict} ${floorGapStr} |`);
      } else {
        console.log('— no comparable recs returned');
      }

      lines.push('');
      lines.push(`### ${scenario.name}`);
      lines.push('');
      lines.push(`**Members:** ${scenario.members.join(', ')}`);
      lines.push('');
      lines.push(`**Claim:** ${scenario.claim}`);
      lines.push('');
      lines.push(`**players_resolved:** ${minResp.players_resolved?.join(', ') || '—'}`);
      if (minResp.players_skipped?.length > 0) {
        lines.push(`**players_skipped:** ${minResp.players_skipped.map((p) => `${p.playerId} (${p.reason})`).join('; ')}`);
      }
      lines.push('');
      lines.push(`#### Top recs (min, egalitarian)`);
      lines.push('```');
      for (let i = 0; i < (minResp.recommendations || []).length; i++) {
        lines.push(fmtRec(minResp.recommendations[i], i));
      }
      lines.push('```');
      lines.push('');
      lines.push(`#### Top recs (mean, the trap)`);
      lines.push('```');
      for (let i = 0; i < (meanResp.recommendations || []).length; i++) {
        lines.push(fmtRec(meanResp.recommendations[i], i));
      }
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

  // Top-level verdict: across all scenarios, did min beat mean on
  // worst-player score? Average the floor gap.
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
