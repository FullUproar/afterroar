import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const summary = await pool.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'unclaimed') AS unclaimed,
    COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
    COUNT(*) FILTER (WHERE status = 'active')    AS active,
    COUNT(*) FILTER (WHERE metadata->>'crowdsourced' = 'true') AS crowdsourced,
    COUNT(*) FILTER (WHERE metadata->>'source' = 'flgs_network_import') AS imported_today
  FROM "Venue"
`);
console.log("Venue table state:");
for (const [k, v] of Object.entries(summary.rows[0])) {
  console.log(`  ${k.padEnd(16)} ${v}`);
}

const states = await pool.query(`
  SELECT state, COUNT(*) AS n
  FROM "Venue"
  WHERE metadata->>'source' = 'flgs_network_import'
  GROUP BY state
  ORDER BY n DESC
  LIMIT 10
`);
console.log("\nTop 10 states (newly imported):");
for (const r of states.rows) {
  console.log(`  ${(r.state ?? "—").padEnd(4)} ${r.n}`);
}

await pool.end();
