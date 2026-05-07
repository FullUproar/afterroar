// profile-game-cli.test.mjs
// ============================================================================
// Tests for the CLI loader in scripts/profile-game.mjs.
//
// We test the exported `loadGames` function (added in Sprint 1.0.25) which
// resolves the three input modes: --bgg-file, --bgg-dir, --bgg-bundle. The
// rest of the CLI is exercised indirectly via the pipeline test suite.
//
// Run with: node --test tests/
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGames } from '../scripts/profile-game.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function tmpPath(name) {
  return join(tmpdir(), `seidr-test-${process.pid}-${Date.now()}-${name}`);
}

function makeGame(id, name = `Game ${id}`) {
  return { id, source: 'bgg', type: 'boardgame', name, weight: 2.5 };
}

// ----------------------------------------------------------------------------
// loadGames: argument validation
// ----------------------------------------------------------------------------

test('loadGames: throws if no source specified', () => {
  assert.throws(
    () => loadGames({ bggFile: null, bggDir: null, bggBundle: null }),
    /required/
  );
});

test('loadGames: throws if multiple sources specified', () => {
  assert.throws(
    () => loadGames({ bggFile: '/some/file', bggBundle: '/some/bundle', bggDir: null }),
    /Specify only ONE/
  );
});

test('loadGames: throws if all three sources specified', () => {
  assert.throws(
    () => loadGames({ bggFile: '/a', bggDir: '/b', bggBundle: '/c' }),
    /Specify only ONE/
  );
});

// ----------------------------------------------------------------------------
// loadGames: --bgg-file mode
// ----------------------------------------------------------------------------

test('loadGames: --bgg-file loads a single game wrapped in an array', () => {
  const path = tmpPath('single.json');
  writeFileSync(path, JSON.stringify(makeGame(167791, 'Terraforming Mars')));
  try {
    const games = loadGames({ bggFile: path, bggDir: null, bggBundle: null });
    assert.equal(games.length, 1);
    assert.equal(games[0].id, 167791);
    assert.equal(games[0].name, 'Terraforming Mars');
  } finally {
    rmSync(path);
  }
});

// ----------------------------------------------------------------------------
// loadGames: --bgg-dir mode
// ----------------------------------------------------------------------------

test('loadGames: --bgg-dir loads every .json file in the directory', () => {
  const dir = tmpPath('dir');
  mkdirSync(dir);
  try {
    writeFileSync(join(dir, '1.json'), JSON.stringify(makeGame(1, 'A')));
    writeFileSync(join(dir, '2.json'), JSON.stringify(makeGame(2, 'B')));
    writeFileSync(join(dir, '3.json'), JSON.stringify(makeGame(3, 'C')));
    // non-JSON file should be ignored
    writeFileSync(join(dir, 'README.txt'), 'ignored');
    const games = loadGames({ bggFile: null, bggDir: dir, bggBundle: null });
    assert.equal(games.length, 3);
    assert.deepEqual(games.map(g => g.id).sort(), [1, 2, 3]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadGames: --bgg-dir empty directory yields empty array', () => {
  const dir = tmpPath('empty');
  mkdirSync(dir);
  try {
    const games = loadGames({ bggFile: null, bggDir: dir, bggBundle: null });
    assert.equal(games.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ----------------------------------------------------------------------------
// loadGames: --bgg-bundle mode (Sprint 1.0.25 addition)
// ----------------------------------------------------------------------------

test('loadGames: --bgg-bundle loads a JSON array of games', () => {
  const path = tmpPath('bundle.json');
  writeFileSync(path, JSON.stringify([
    makeGame(1, 'A'),
    makeGame(2, 'B'),
    makeGame(3, 'C'),
  ]));
  try {
    const games = loadGames({ bggFile: null, bggDir: null, bggBundle: path });
    assert.equal(games.length, 3);
    assert.deepEqual(games.map(g => g.id), [1, 2, 3]);
  } finally {
    rmSync(path);
  }
});

test('loadGames: --bgg-bundle handles a 225-game bundle (real Manus shape)', () => {
  // Synthesize a bundle with the same shape Manus delivers
  const path = tmpPath('big-bundle.json');
  const games = [];
  for (let i = 1; i <= 225; i++) {
    games.push({
      id: i,
      source: 'bgg',
      type: 'boardgame',
      name: `Game ${i}`,
      year: 2020,
      weight: 2.5 + (i % 10) / 10,
      minPlayers: 2,
      maxPlayers: 4,
      bggSubdomains: ['Strategy Games'],
    });
  }
  writeFileSync(path, JSON.stringify(games));
  try {
    const loaded = loadGames({ bggFile: null, bggDir: null, bggBundle: path });
    assert.equal(loaded.length, 225);
    assert.equal(loaded[0].id, 1);
    assert.equal(loaded[224].id, 225);
  } finally {
    rmSync(path);
  }
});

test('loadGames: --bgg-bundle empty array returns empty array', () => {
  const path = tmpPath('empty-bundle.json');
  writeFileSync(path, '[]');
  try {
    const games = loadGames({ bggFile: null, bggDir: null, bggBundle: path });
    assert.equal(games.length, 0);
  } finally {
    rmSync(path);
  }
});

test('loadGames: --bgg-bundle rejects non-array JSON (object)', () => {
  const path = tmpPath('not-array.json');
  writeFileSync(path, JSON.stringify({ foo: 'bar' }));
  try {
    assert.throws(
      () => loadGames({ bggFile: null, bggDir: null, bggBundle: path }),
      /not a JSON array/
    );
  } finally {
    rmSync(path);
  }
});

test('loadGames: --bgg-bundle rejects non-array JSON (string)', () => {
  const path = tmpPath('string-bundle.json');
  writeFileSync(path, JSON.stringify('not a bundle'));
  try {
    assert.throws(
      () => loadGames({ bggFile: null, bggDir: null, bggBundle: path }),
      /not a JSON array/
    );
  } finally {
    rmSync(path);
  }
});

// ----------------------------------------------------------------------------
// Integration: load Manus's actual bgg-top25-bundle.json
// ----------------------------------------------------------------------------

test('integration: --bgg-bundle loads the real bgg-top25-bundle.json (225 games)', () => {
  const bundlePath = resolve(__dirname, '..', 'data', 'bgg-top25-bundle.json');
  const games = loadGames({ bggFile: null, bggDir: null, bggBundle: bundlePath });
  assert.equal(games.length, 225);
  // Spot-check: Brass: Birmingham should be present (BGG #1 overall)
  const brass = games.find(g => g.id === 224517);
  assert.ok(brass, 'Brass: Birmingham (224517) not in bundle');
  assert.equal(brass.name, 'Brass: Birmingham');
  // Every entry should have an id, name, and bggSubdomains array
  for (const g of games) {
    assert.ok(Number.isInteger(g.id), `entry missing integer id: ${JSON.stringify(g).slice(0, 80)}`);
    assert.ok(typeof g.name === 'string', `entry missing name: ${g.id}`);
    assert.ok(Array.isArray(g.bggSubdomains), `entry missing bggSubdomains array: ${g.id}`);
  }
});
