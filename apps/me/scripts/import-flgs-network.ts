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
/**
 * --replace: purge stale "junk" rows before importing. ONLY deletes Venue
 * rows where ALL of:
 *   - status = "unclaimed" (so claimed/active/pending rows are protected)
 *   - metadata.crowdsourced is not true (so user-submitted rows are protected)
 *   - no AfterroarEntity exists with the same slug (so anything that's been
 *     touched by the claim flow stays put)
 * Use when the upstream dataset is the new source of truth and the existing
 * rows are stale imports.
 */
const replace = args.includes("--replace");

if (!inputPath) {
  console.error("Usage: tsx scripts/import-flgs-network.ts <input.csv|input.json> [--dry-run] [--update] [--replace]");
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

/**
 * State-machine CSV parser. Handles:
 *   - quoted fields containing commas: "Foo, Bar"
 *   - escaped quotes inside quoted fields: "she said ""hi""" → she said "hi"
 *   - newlines inside quoted fields (multi-line addresses, etc.)
 *   - Windows / Unix / classic-Mac line endings
 *
 * Returns: array of records (one per row), each as { [columnName]: string }.
 * Empty strings stay empty strings; the caller decides what to nullify.
 */
function parseCsvRobust(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (c === "\r" || c === "\n") {
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        // consume \r\n as one
        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  // Trailing field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const records: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = (cells[c] ?? "").trim();
    }
    records.push(rec);
  }
  return records;
}

function parseCsv(text: string): FlgsRow[] {
  const records = parseCsvRobust(text);
  const rows: FlgsRow[] = [];
  for (const rec of records) {
    const get = (col: string): string | null => {
      const v = rec[col.toLowerCase()];
      return v && v.length > 0 ? v : null;
    };
    // Accept several common spellings for the name column. Lead-Harvester
    // exports use `store_name`; older hand-curated CSVs use `name`.
    const name = get("name") ?? get("store_name");
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

/**
 * In-memory slug collision check. We pre-fetch every existing Venue slug
 * once at start, then dedup against the in-memory set as we walk the input.
 * For 6k+ rows this turns ~12k Neon roundtrips (1 lookup + 1 existing-fetch
 * per row) into a single SELECT slug FROM Venue plus zero DB hits during
 * the loop until we either skip or write.
 */
function uniqueSlugSync(base: string, taken: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
    if (n > 100) throw new Error(`Could not find unique slug for ${base}`);
  }
  taken.add(candidate);
  return candidate;
}

async function main() {
  const fullPath = resolve(inputPath!);
  const raw = readFileSync(fullPath, "utf8");
  const rows: FlgsRow[] = inputPath!.endsWith(".json") ? JSON.parse(raw) : parseCsv(raw);

  console.log(`→ ${rows.length} rows parsed from ${inputPath}${dryRun ? " (dry run)" : ""}`);

  // Track simulated purges so the dry-run loop count reflects post-purge state.
  let purgedSlugSetForDryRun = new Set<string>();

  // ── Replace mode: purge stale-import rows first ──
  if (replace) {
    console.log("→ --replace: identifying stale-import rows…");

    // Pull every claimed/pending AfterroarEntity slug — those Venues are
    // protected even if Venue.status still says unclaimed (claim in flight
    // races where Venue hasn't been bumped yet).
    const protectedEntitySlugs = new Set(
      (await prisma.afterroarEntity.findMany({ select: { slug: true } })).map((e) => e.slug),
    );

    // Candidates for deletion: status=unclaimed, NOT crowdsourced, NOT in
    // any protected entity slug list.
    // (Prisma JSON path filtering for "not equals true" is awkward;
    // simplest is to pull all unclaimed Venues + their metadata in one
    // query and filter in memory.)
    const unclaimedRows = await prisma.venue.findMany({
      where: { status: "unclaimed" },
      select: { id: true, slug: true, metadata: true, name: true },
    });

    const toDelete = unclaimedRows.filter((v) => {
      if (protectedEntitySlugs.has(v.slug)) return false;
      const meta = (v.metadata as Record<string, unknown> | null) ?? {};
      if (meta.crowdsourced === true) return false;
      return true;
    });

    console.log(
      `  ${unclaimedRows.length} unclaimed Venues found — ${toDelete.length} eligible for purge ` +
      `(${unclaimedRows.length - toDelete.length} protected: claimed-or-crowdsourced)`,
    );

    if (toDelete.length > 0 && !dryRun) {
      // Chunked delete — Postgres handles `id IN (...)` but enormous IN
      // lists slow the planner. Batch into 500-id chunks.
      const ids = toDelete.map((v) => v.id);
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const result = await prisma.venue.deleteMany({ where: { id: { in: slice } } });
        console.log(`  …purged ${i + result.count}/${ids.length}`);
      }
    } else if (dryRun && toDelete.length > 0) {
      console.log(`  (dry run — would purge ${toDelete.length} rows)`);
    }
    // In dry-run mode, expose the purged-slug set so the loop counts as
    // if the purge had happened (otherwise skipped/created counts lie).
    purgedSlugSetForDryRun = new Set(toDelete.map((v) => v.slug));
  }

  // Pre-fetch every existing Venue slug + status so we can dedup in-memory
  // and decide skip-vs-update without per-row DB calls.
  console.log("→ pre-fetching existing Venue slugs…");
  let existingVenues = await prisma.venue.findMany();
  if (dryRun && purgedSlugSetForDryRun.size > 0) {
    const before = existingVenues.length;
    existingVenues = existingVenues.filter((v) => !purgedSlugSetForDryRun.has(v.slug));
    console.log(`  (dry run: simulating purge — ${before} → ${existingVenues.length} remaining)`);
  }
  const existingSlugSet = new Set(existingVenues.map((v) => v.slug));
  const existingBySlug = new Map(existingVenues.map((v) => [v.slug, v]));
  console.log(`  ${existingVenues.length} existing venues already in directory`);

  // Track slugs we'll mint during this run (matters for in-batch collisions)
  const takenSlugs = new Set<string>(existingSlugSet);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: FlgsRow; reason: string }[] = [];

  const PROGRESS_EVERY = 500;
  for (let idx = 0; idx < rows.length; idx++) {
    if (idx > 0 && idx % PROGRESS_EVERY === 0) {
      console.log(`  …${idx}/${rows.length} (created ${created}, updated ${updated}, skipped ${skipped}, errors ${errors.length})`);
    }
    const row = rows[idx];
    try {
      const baseSlug = row.slug ? slugify(row.slug) : slugify(row.name);
      // If the bare slug already exists and belongs to a row we'd update
      // (or skip), prefer it over minting a new one — this lets re-runs of
      // the same input keep matching the same target rows.
      const reuseExisting = existingSlugSet.has(baseSlug);
      const finalSlug = reuseExisting ? baseSlug : uniqueSlugSync(baseSlug, takenSlugs);

      const existing = existingBySlug.get(finalSlug) ?? null;
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
          await prisma.venue.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              website: row.websiteUrl ?? existing.website,
              email: row.contactEmail ?? existing.email,
              phone: row.contactPhone ?? existing.phone,
              address: row.addressLine1 ?? existing.address,
              city: row.city ?? existing.city,
              state: row.state ?? existing.state,
              zip: row.postalCode ?? existing.zip,
              lat: row.latitude ?? existing.lat,
              lng: row.longitude ?? existing.lng,
              description: row.description ?? existing.description,
              logoUrl: row.logoUrl ?? existing.logoUrl,
            },
          });
        }
        updated++;
        continue;
      }

      if (!dryRun) {
        await prisma.venue.create({
          data: {
            slug: finalSlug,
            name: row.name,
            status: "unclaimed",
            venueType: "game_store",
            website: row.websiteUrl ?? null,
            email: row.contactEmail ?? null,
            phone: row.contactPhone ?? null,
            address: row.addressLine1 ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
            zip: row.postalCode ?? null,
            lat: row.latitude ?? null,
            lng: row.longitude ?? null,
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
