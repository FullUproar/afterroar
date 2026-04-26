/**
 * Bulk import FLGS network → AfterroarEntity rows with status="unclaimed".
 *
 * Each row in the input becomes an entity that anyone visiting
 * /stores/{slug} can see (limited info) and claim. The claim flow then
 * verifies the claimant via email magic link and flips status → "active"
 * with the claimant added as the first EntityMember (role=owner).
 *
 * Usage:
 *   set -a && . .env.local && set +a && \
 *     npx tsx scripts/import-flgs-network.ts <input.csv|input.json> [--dry-run]
 *
 * CSV header expected (case-insensitive, columns are optional except name):
 *   name, slug, websiteUrl, contactEmail, contactName, contactPhone,
 *   addressLine1, addressLine2, city, state, postalCode, country,
 *   latitude, longitude, description, logoUrl
 *
 * Slug strategy:
 *   - Use the `slug` column if provided.
 *   - Otherwise generate from name: lowercase, dashes, dedup with -2/-3 suffix
 *     when collisions exist in the same import or in the DB.
 *
 * Idempotent: existing entities matched by slug are SKIPPED by default
 * (use --update to refresh fields on existing unclaimed rows; never touches
 * status="active" or "pending" rows).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface FlgsRow {
  name: string;
  slug?: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  logoUrl?: string | null;
}

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const update = args.includes("--update");

if (!inputPath) {
  console.error("Usage: tsx scripts/import-flgs-network.ts <input.csv|input.json> [--dry-run] [--update]");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseCsv(text: string): FlgsRow[] {
  // Minimal CSV parser — splits on newlines + commas, trims, treats empty
  // strings as null. Doesn't handle quoted commas; fine for our seed data
  // (FLGS network CSV is hand-curated). For messier data, use --json.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (col: string) => header.indexOf(col.toLowerCase());
  const rows: FlgsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const get = (col: string): string | null => {
      const j = idx(col);
      if (j < 0) return null;
      const val = cells[j];
      return val && val.length > 0 ? val : null;
    };
    const name = get("name");
    if (!name) continue;
    rows.push({
      name,
      slug: get("slug") ?? undefined,
      websiteUrl: get("websiteurl") ?? get("website"),
      contactEmail: get("contactemail") ?? get("email"),
      contactName: get("contactname"),
      contactPhone: get("contactphone") ?? get("phone"),
      addressLine1: get("addressline1") ?? get("address"),
      addressLine2: get("addressline2"),
      city: get("city"),
      state: get("state"),
      postalCode: get("postalcode") ?? get("zip"),
      country: get("country") ?? "US",
      latitude: get("latitude") ? Number(get("latitude")) : null,
      longitude: get("longitude") ? Number(get("longitude")) : null,
      description: get("description"),
      logoUrl: get("logourl") ?? get("logo"),
    });
  }
  return rows;
}

async function uniqueSlug(base: string, seen: Set<string>): Promise<string> {
  let candidate = base;
  let n = 2;
  while (seen.has(candidate) || (await prisma.afterroarEntity.findUnique({ where: { slug: candidate } }))) {
    candidate = `${base}-${n}`;
    n++;
    if (n > 100) throw new Error(`Could not find unique slug for ${base}`);
  }
  seen.add(candidate);
  return candidate;
}

async function main() {
  const fullPath = resolve(inputPath!);
  const raw = readFileSync(fullPath, "utf8");
  const rows: FlgsRow[] = inputPath!.endsWith(".json") ? JSON.parse(raw) : parseCsv(raw);

  console.log(`→ ${rows.length} rows from ${inputPath}${dryRun ? " (dry run)" : ""}`);

  const seenSlugs = new Set<string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: FlgsRow; reason: string }[] = [];

  for (const row of rows) {
    try {
      const baseSlug = row.slug ? slugify(row.slug) : slugify(row.name);
      const finalSlug = await uniqueSlug(baseSlug, seenSlugs);

      const existing = await prisma.afterroarEntity.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        if (existing.status !== "unclaimed") {
          skipped++;
          continue; // never touch claimed/active/pending rows
        }
        if (!update) {
          skipped++;
          continue;
        }
        if (!dryRun) {
          await prisma.afterroarEntity.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              websiteUrl: row.websiteUrl ?? existing.websiteUrl,
              contactEmail: row.contactEmail ?? existing.contactEmail,
              contactName: row.contactName ?? existing.contactName,
              contactPhone: row.contactPhone ?? existing.contactPhone,
              addressLine1: row.addressLine1 ?? existing.addressLine1,
              addressLine2: row.addressLine2 ?? existing.addressLine2,
              city: row.city ?? existing.city,
              state: row.state ?? existing.state,
              postalCode: row.postalCode ?? existing.postalCode,
              country: row.country ?? existing.country,
              latitude: row.latitude ?? existing.latitude,
              longitude: row.longitude ?? existing.longitude,
              description: row.description ?? existing.description,
              logoUrl: row.logoUrl ?? existing.logoUrl,
            },
          });
        }
        updated++;
        continue;
      }

      if (!dryRun) {
        await prisma.afterroarEntity.create({
          data: {
            slug: finalSlug,
            name: row.name,
            type: "store",
            status: "unclaimed",
            websiteUrl: row.websiteUrl ?? null,
            contactEmail: row.contactEmail ?? null,
            contactName: row.contactName ?? null,
            contactPhone: row.contactPhone ?? null,
            addressLine1: row.addressLine1 ?? null,
            addressLine2: row.addressLine2 ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
            postalCode: row.postalCode ?? null,
            country: row.country ?? "US",
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            description: row.description ?? null,
            logoUrl: row.logoUrl ?? null,
            metadata: { source: "flgs_network_import", imported_at: new Date().toISOString() },
          },
        });
      }
      created++;
    } catch (err) {
      errors.push({ row, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\n──────── Summary ────────");
  console.log(`Created:  ${created}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped}  (existing rows; pass --update to refresh unclaimed)`);
  console.log(`Errors:   ${errors.length}`);
  for (const e of errors.slice(0, 10)) {
    console.log(`  ✗ ${e.row.name}: ${e.reason}`);
  }
  if (errors.length > 10) console.log(`  …and ${errors.length - 10} more`);
  if (dryRun) console.log("\n(dry run — no DB writes)");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
