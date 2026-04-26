import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 config — required because the schema datasource no longer
 * accepts a `url`. We point migrate at the same Postgres URL the runtime
 * uses (DATABASE_URL).
 *
 * Run with the env loaded:
 *   set -a && . ../../apps/ops/.env.local && set +a && npx prisma db push
 */
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
