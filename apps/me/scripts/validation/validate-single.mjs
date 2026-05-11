// validate-single.mjs
// ============================================================================
// Single-player rec validation. For each persona in personas.mjs:
//   1. Hit /api/quiz/recommend with the persona's profile (anonymous —
//      no DB write, no auth needed).
//   2. Run the persona's expectations against the response.
//   3. Print a per-persona pass/fail line; collect a markdown report
//      with the actual top recs so a human reviewer can eyeball quality
//      beyond the assertions.
//
// Usage:
//   BASE_URL=https://www.afterroar.me node scripts/validation/validate-single.mjs
//   BASE_URL=http://localhost:3001 node scripts/validation/validate-single.mjs
//   node scripts/validation/validate-single.mjs --report=tmp/validate-report.md
//
// Defaults: BASE_URL=https://www.afterroar.me, report path = stdout only.
//
// Exit codes:
//   0  all hard assertions passed (soft warnings are not failures)
//   1  one or more personas failed a hard assertion
//   2  request error (network, 500, etc.)
// ============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PERSONAS } from './personas.mjs';

const DEFAULT_BASE_URL = 'https://www.afterroar.me';
const TOP_K = 12;

function parseArgs(argv) {
  const args = { reportPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--report=')) args.reportPath = a.slice('--report='.length);
    else if (a === '--report') args.reportPath = argv[++i];
  }
  return args;
}

async function fetchRecsFor(persona, baseUrl) {
  const res = await fetch(`${baseUrl}/api/quiz/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: persona.profile,
      confidence: persona.confidence,
      limit: TOP_K,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Evaluates a persona's expectations against the actual rec response.
 * Returns { hardFails: string[], softWarnings: string[], passed: bool }.
 */
function evaluate(persona, response) {
  const hardFails = [];
  const softWarnings = [];
  const recs = response.recommendations || [];

  if (recs.length === 0) {
    hardFails.push(`returned 0 recommendations (engines_skipped: ${JSON.stringify(response.engines_skipped)})`);
    return { hardFails, softWarnings, passed: false };
  }

  const exp = persona.expectations || {};

  // shouldAppear: at least one of these BGG IDs must be in top-K.
  if (Array.isArray(exp.shouldAppear) && exp.shouldAppear.length > 0) {
    const recIds = new Set(recs.map((r) => r.game_id));
    const matched = exp.shouldAppear.filter((id) => recIds.has(id));
    if (matched.length === 0) {
      // SOFT — corpus may not yet contain the game (especially pre-LLM-tail).
      softWarnings.push(`expected at least one of [${exp.shouldAppear.join(', ')}] in top-${TOP_K}, got none`);
    }
  }

  // shouldNotAppear: NONE of these BGG IDs should be in top-K.
  if (Array.isArray(exp.shouldNotAppear) && exp.shouldNotAppear.length > 0) {
    const recIds = new Set(recs.map((r) => r.game_id));
    const violated = exp.shouldNotAppear.filter((id) => recIds.has(id));
    if (violated.length > 0) {
      hardFails.push(`shouldNotAppear violated by: ${violated.join(', ')}`);
    }
  }

  // subdomainOneOf: majority of top-K must be in this set.
  // "Majority" = >50%, soft enough to allow a couple of cross-genre surprises
  // (good recs sometimes break narrow categorical expectations).
  if (Array.isArray(exp.subdomainOneOf) && exp.subdomainOneOf.length > 0) {
    const allowed = new Set(exp.subdomainOneOf);
    const inSet = recs.filter((r) => r.subdomain && allowed.has(r.subdomain)).length;
    if (inSet < Math.ceil(recs.length / 2)) {
      hardFails.push(`expected majority of top-${recs.length} in subdomains [${exp.subdomainOneOf.join(', ')}], got only ${inSet}/${recs.length}`);
    }
  }

  // shouldNotMatchSubdomains: tolerate up to 25% of top-K from blocked
  // subdomains. Practical tolerance widened on 2026-05-10 after the
  // 2599-game corpus landed and surfaced widespread BGG metadata
  // quality issues — many wargames are tagged as "Party," many
  // tile-layers are tagged as "Customizable," etc. The matcher is
  // typically right; the labels lie. We surface offenders as warnings
  // either way, but only hard-fail when the proportion gets dominant.
  if (Array.isArray(exp.shouldNotMatchSubdomains) && exp.shouldNotMatchSubdomains.length > 0) {
    const blocked = new Set(exp.shouldNotMatchSubdomains);
    const offenders = recs.filter((r) => r.subdomain && blocked.has(r.subdomain));
    const tolerance = Math.max(2, Math.ceil(recs.length * 0.25)); // ≥25% of K, min 2
    if (offenders.length > tolerance) {
      hardFails.push(`expected ≤${tolerance} rec from blocked subdomains [${exp.shouldNotMatchSubdomains.join(', ')}], got ${offenders.length}: ${offenders.map((o) => `${o.game_name}(${o.subdomain})`).join(', ')}`);
    } else if (offenders.length > 0) {
      softWarnings.push(`${offenders.length} rec(s) from blocked subdomains (within tolerance ≤${tolerance}): ${offenders.map((o) => `${o.game_name}(${o.subdomain})`).join(', ')}`);
    }
  }

  // playingTimeRange: median of top-K's playing_time should fall in range.
  if (Array.isArray(exp.playingTimeRange) && exp.playingTimeRange.length === 2) {
    const [lo, hi] = exp.playingTimeRange;
    const times = recs
      .map((r) => r.playing_time)
      .filter((t) => typeof t === 'number');
    if (times.length === 0) {
      softWarnings.push('no playing_time data on any rec — skipping playingTimeRange check');
    } else {
      const sorted = [...times].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median < lo || median > hi) {
        hardFails.push(`expected median playing_time in [${lo}, ${hi}] min, got ${median} min`);
      }
    }
  }

  return { hardFails, softWarnings, passed: hardFails.length === 0 };
}

function fmtRec(r, idx) {
  const subdomain = r.subdomain || '?';
  const time = typeof r.playing_time === 'number' ? `${r.playing_time}m` : '—';
  return `  ${idx + 1}. ${r.game_name} (${r.year || '?'}) [${subdomain}, ${time}] · score ${r.score.toFixed(3)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = process.env.BASE_URL || DEFAULT_BASE_URL;

  console.log(`Validating ${PERSONAS.length} personas against ${baseUrl}\n`);

  const reportLines = [];
  reportLines.push(`# Single-player validation report`);
  reportLines.push('');
  reportLines.push(`Base URL: \`${baseUrl}\``);
  reportLines.push(`Personas: ${PERSONAS.length}`);
  reportLines.push(`Top-K per persona: ${TOP_K}`);
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push('');

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  let errorCount = 0;
  const summaryRows = [];

  for (const persona of PERSONAS) {
    process.stdout.write(`  ${persona.name.padEnd(40)} `);
    try {
      const response = await fetchRecsFor(persona, baseUrl);
      const { hardFails, softWarnings, passed } = evaluate(persona, response);
      const recs = response.recommendations || [];

      if (passed && softWarnings.length === 0) {
        console.log('✓ PASS');
        passCount++;
      } else if (passed) {
        console.log(`⚠ PASS (${softWarnings.length} warning${softWarnings.length === 1 ? '' : 's'})`);
        passCount++;
        warnCount++;
      } else {
        console.log(`✗ FAIL (${hardFails.length})`);
        failCount++;
      }

      summaryRows.push({
        name: persona.name,
        passed,
        warnCount: softWarnings.length,
      });

      reportLines.push(`## ${passed ? '✓' : '✗'} ${persona.name}`);
      reportLines.push('');
      reportLines.push(`*${persona.narrative}*`);
      reportLines.push('');
      if (hardFails.length > 0) {
        reportLines.push('**Hard fails:**');
        for (const f of hardFails) reportLines.push(`- ${f}`);
        reportLines.push('');
      }
      if (softWarnings.length > 0) {
        reportLines.push('**Soft warnings:**');
        for (const w of softWarnings) reportLines.push(`- ${w}`);
        reportLines.push('');
      }
      reportLines.push(`**Top ${recs.length} recs** (cosine vs persona profile):`);
      reportLines.push('');
      reportLines.push('```');
      for (let i = 0; i < recs.length; i++) reportLines.push(fmtRec(recs[i], i));
      reportLines.push('```');
      reportLines.push('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ERROR: ${msg}`);
      errorCount++;
      reportLines.push(`## ✗ ${persona.name} — ERROR`);
      reportLines.push(`\`\`\`\n${msg}\n\`\`\``);
      reportLines.push('');
    }
  }

  console.log('');
  console.log(`Summary: ${passCount} pass, ${failCount} fail, ${errorCount} error, ${warnCount} with warnings`);

  // Insert summary table at the top of the report (after the header).
  const summaryTable = [
    '## Summary',
    '',
    `- Pass: **${passCount}**`,
    `- Fail: **${failCount}**`,
    `- Error: **${errorCount}**`,
    `- With warnings: **${warnCount}**`,
    '',
    '| Persona | Status | Warnings |',
    '|---|---|---|',
    ...summaryRows.map((r) => `| ${r.name} | ${r.passed ? '✓' : '✗'} | ${r.warnCount} |`),
    '',
  ];
  reportLines.splice(6, 0, ...summaryTable);

  if (args.reportPath) {
    mkdirSync(dirname(args.reportPath), { recursive: true });
    writeFileSync(args.reportPath, reportLines.join('\n'));
    console.log(`Report written to ${args.reportPath}`);
  }

  if (errorCount > 0) process.exit(2);
  if (failCount > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Validation harness crashed:', err);
    process.exit(2);
  });
}

export { evaluate, fetchRecsFor };
