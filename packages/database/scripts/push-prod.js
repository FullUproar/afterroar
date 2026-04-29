/**
 * One-shot helper for `prisma db push` against the *afterroar-pos-prod*
 * Neon project. Reads the URL from a Vercel-pulled env file (so we never
 * hand-edit it), maps to DATABASE_URL, then spawns prisma.
 *
 * Why this exists: Prisma 7 in driver-adapter mode reads DATABASE_URL via
 * dotenv at config-load time. Inlining the connection string in a shell
 * command mangles special chars (?, &, =) on Windows. Doing it through a
 * Node script avoids both.
 *
 * Prisma 7 always regenerates after push; that's fine — it matches what
 * `pnpm install` does anyway via the database package's `postinstall` hook.
 *
 * USAGE: node packages/database/scripts/push-prod.js [vercel-env-path]
 *   default vercel-env-path: apps/ops/.env.vercel-prod-check
 */

const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const envFile =
  process.argv[2] ?? path.join(repoRoot, "apps", "ops", ".env.vercel-prod-check");
const schemaPath = path.resolve(__dirname, "..", "prisma", "schema.prisma");

if (!fs.existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  console.error("Pull it first:  vercel env pull <path> --environment=production --yes");
  process.exit(1);
}

require("dotenv").config({ path: envFile });

// Direct (non-pooled) URL is the right choice for DDL — the pooler can drop
// session-level state mid-migration. Fall back to pooled if the unpooled var
// isn't present.
const directUrl =
  process.env.NEON_DATABASE_URL_UNPOOLED ||
  process.env.NEON_POSTGRES_URL_NON_POOLING;
const pooledUrl =
  process.env.NEON_DATABASE_URL ||
  process.env.NEON_POSTGRES_PRISMA_URL ||
  process.env.NEON_POSTGRES_URL;

const url = directUrl || pooledUrl;
if (!url) {
  console.error("No NEON_* postgres URL found in env file.");
  process.exit(1);
}

// Mask + log the host so we can confirm the right project before push.
let host;
try {
  host = new URL(url.replace(/^postgres(ql)?:\/\//, "http://")).host;
} catch {
  host = "unparseable";
}
console.log("Target host:", host);
console.log("Using",  directUrl ? "DIRECT (unpooled)" : "POOLED", "connection");

if (!host.includes("steep-king")) {
  console.error(`SAFETY ABORT: host '${host}' does not match the expected afterroar-pos-prod pattern (ep-steep-king-*).`);
  console.error("This script refuses to push to any other Neon project to prevent the 2026-04-27 incident.");
  process.exit(1);
}

// cd into packages/database so prisma.config.ts is auto-discovered.
// Avoids passing --schema with a path that contains spaces (Windows quoting
// hell when shell:true is in play).
const dbPackageDir = path.resolve(__dirname, "..");
const env = { ...process.env, DATABASE_URL: url };
const result = spawnSync(
  "npx",
  ["prisma", "db", "push"],
  { stdio: "inherit", env, shell: true, cwd: dbPackageDir },
);
process.exit(result.status ?? 1);
