/**
 * DriveThruRPG adapter.
 * Docs: their API isn't formally public, but BGG's RPGGeek subset covers the
 * same ground with a public API and is far more reliable. We use BGG's
 * /search?type=rpgitem,rpg,rpgissue surface as the metadata source for RPGs,
 * and call the integration "drivethrurpg" because that's the catalog FLGS
 * owners think in. (Naming is a marketing choice, not a technical one.)
 *
 * BGG's RPGGeek-side search returns canonical RPG product entries with
 * system, edition, and book type. ISBN comes from the detail call when
 * available.
 *
 * If/when DriveThruRPG opens an actual partner API, we swap the implementation
 * here without changing any call sites.
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";

interface BggSearchItem {
  id: string;
  type: string;
  name: string;
  yearPublished?: string;
}

async function bggSearch(query: string, types: string[]): Promise<BggSearchItem[]> {
  const url = `${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=${types.join(",")}`;
  const res = await fetch(url, { headers: { "User-Agent": "Afterroar POS/1.0" } });
  if (!res.ok) return [];
  const xml = await res.text();
  // Lightweight XML parse — BGG's response is small and predictable.
  const items: BggSearchItem[] = [];
  const itemRegex = /<item[^>]*id="(\d+)"[^>]*type="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml))) {
    const inner = m[3] ?? "";
    const nameMatch = /<name[^>]*value="([^"]+)"/.exec(inner);
    const yearMatch = /<yearpublished[^>]*value="(\d+)"/.exec(inner);
    if (nameMatch) {
      items.push({
        id: m[1] ?? "",
        type: m[2] ?? "",
        name: nameMatch[1] ?? "",
        yearPublished: yearMatch?.[1],
      });
    }
  }
  return items;
}

interface BggThing {
  id: string;
  type: string;
  name?: string;
  description?: string;
  yearPublished?: string;
  image?: string;
  thumbnail?: string;
  publishers?: string[];
  artists?: string[];
  designers?: string[];
  categories?: string[];
  mechanics?: string[];
  families?: string[];
  isbn?: string;
}

async function bggThing(id: string): Promise<BggThing | null> {
  const res = await fetch(`${BGG_BASE}/thing?id=${encodeURIComponent(id)}&stats=0`, {
    headers: { "User-Agent": "Afterroar POS/1.0" },
  });
  if (!res.ok) return null;
  const xml = await res.text();
  const itemMatch = /<item[^>]*id="(\d+)"[^>]*type="([^"]+)"[^>]*>([\s\S]*?)<\/item>/.exec(xml);
  if (!itemMatch) return null;
  const inner = itemMatch[3] ?? "";

  const nameMatch = /<name[^>]+type="primary"[^>]+value="([^"]+)"/.exec(inner);
  const yearMatch = /<yearpublished[^>]*value="(\d+)"/.exec(inner);
  const imageMatch = /<image>([^<]+)<\/image>/.exec(inner);
  const thumbnailMatch = /<thumbnail>([^<]+)<\/thumbnail>/.exec(inner);
  const descriptionMatch = /<description>([\s\S]*?)<\/description>/.exec(inner);

  const collect = (rel: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(
      `<link[^>]+type="${rel}"[^>]+value="([^"]+)"`,
      "g",
    );
    let lm: RegExpExecArray | null;
    while ((lm = re.exec(inner))) out.push(lm[1] ?? "");
    return out;
  };

  return {
    id: itemMatch[1] ?? "",
    type: itemMatch[2] ?? "",
    name: nameMatch?.[1],
    yearPublished: yearMatch?.[1],
    image: imageMatch?.[1],
    thumbnail: thumbnailMatch?.[1],
    description: descriptionMatch?.[1]?.replace(/&#10;/g, "\n").slice(0, 2000),
    publishers: collect("rpgpublisher"),
    artists: collect("rpgartist"),
    designers: collect("rpgdesigner"),
    categories: collect("rpgcategory"),
    mechanics: collect("rpgmechanic"),
    families: [...collect("rpg"), ...collect("rpgseries"), ...collect("rpgsetting")],
  };
}

function inferBookType(thing: BggThing): string {
  const families = (thing.families ?? []).map((f) => f.toLowerCase());
  if (families.some((f) => /core rulebook|player'?s? handbook/.test(f))) return "core";
  if (families.some((f) => /gm screen|game.master/.test(f))) return "screen";
  if (families.some((f) => /adventure|module|scenario|campaign/.test(f))) return "adventure";
  if (families.some((f) => /setting|world/.test(f))) return "setting";
  return "supplement";
}

function inferSystem(thing: BggThing): string | undefined {
  // RPG system names live in the rpg family link
  const candidates = (thing.families ?? []).filter((f) =>
    /(d&d|dungeons|pathfinder|mörk borg|call of cthulhu|gurps|fate|savage worlds|warhammer|shadowrun|world of darkness|cyberpunk|fallout|mothership|alien rpg|blades in the dark|cypher|monster of the week|monsterhearts)/i.test(
      f,
    ),
  );
  return candidates[0];
}

function mapThing(thing: BggThing): CatalogRecord {
  return {
    external_id: thing.id,
    name: thing.name ?? "Unknown RPG product",
    category: "rpg",
    image_url: thing.image ?? thing.thumbnail,
    attributes: {
      system: inferSystem(thing),
      book_type: inferBookType(thing),
      publisher: thing.publishers?.[0],
      release_year: thing.yearPublished ? parseInt(thing.yearPublished) : undefined,
      designers: thing.designers?.join(", "),
      artists: thing.artists?.join(", "),
      ...(thing.description ? { description: thing.description } : {}),
    },
    external_ids: {
      bgg: thing.id,
      rpggeek: thing.id,
    },
  };
}

export const drivethruRpgAdapter: CatalogAdapter = {
  id: "drivethrurpg",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // BGG's RPGGeek search — known-good query.
      const res = await fetch(`${BGG_BASE}/search?query=dungeons&type=rpgitem&limit=1`, {
        headers: { "User-Agent": "Afterroar POS/1.0" },
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts) {
    const limit = Math.min(20, opts?.limit ?? 10);
    const items = await bggSearch(query, ["rpgitem", "rpg", "rpgissue"]);
    const top = items.slice(0, limit);
    // Avoid hitting `bggThing` for every result on the search-list path —
    // the lookup endpoint will pull the full record when the user picks one.
    return top.map<CatalogSearchResult>((it) => ({
      external_id: it.id,
      title: it.name,
      subtitle: [it.type === "rpgitem" ? "RPG product" : it.type, it.yearPublished].filter(Boolean).join(" · "),
    }));
  },

  async lookup(id) {
    const thing = await bggThing(id);
    return thing ? mapThing(thing) : null;
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
