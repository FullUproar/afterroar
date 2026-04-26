// Apply a SQL migration file via node-postgres (since we don't have psql).
// Usage:
//   set -a && . ../../apps/ops/.env.local && set +a && \
//     node migrations/apply.mjs migrations/<file>.sql
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node migrations/apply.mjs <sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon needs SSL but the connection string usually carries `sslmode=require`.
  ssl: { rejectUnauthorized: false },
});

try {
  console.log(`→ Applying ${file}…`);
  const result = await pool.query(sql);
  // pg returns an array when the script has multiple statements.
  const arr = Array.isArray(result) ? result : [result];
  console.log(`✓ Applied ${arr.length} statement(s).`);
} catch (err) {
  console.error("✗ Migration failed:");
  console.error(err.message || err);
  process.exit(1);
} finally {
  await pool.end();
}
