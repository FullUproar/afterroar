/**
 * Pokémon TCG API adapter.
 * Docs: https://docs.pokemontcg.io/
 * - Free tier works without auth at modest rate limits (POKEMON_TCG_API_KEY raises them).
 * - Returns rich card data: name, set, hp, types, attacks, rarity, image, prices (TCGPlayer-mirrored).
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BASE = "https://api.pokemontcg.io/v2";

interface PtcgCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  set?: { id: string; name: string; series?: string; releaseDate?: string };
  number?: string;
  rarity?: string;
  artist?: string;
  flavorText?: string;
  images?: { small?: string; large?: string };
  tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, { market?: number; low?: number; mid?: number; high?: number }> };
  cardmarket?: { url?: string; prices?: Record<string, number> };
}

function authHeaders(): Record<string, string> {
  const key = process.env.POKEMON_TCG_API_KEY;
  return key ? { "X-Api-Key": key } : {};
}

function pickMarketCents(card: PtcgCard): number | undefined {
  const variants = card.tcgplayer?.prices ?? {};
  for (const variant of ["holofoil", "normal", "reverseHolofoil", "1stEditionHolofoil"]) {
    const p = variants[variant];
    if (p?.market) return Math.round(p.market * 100);
  }
  // Fall back to any variant's market
  const any = Object.values(variants).find((v) => typeof v?.market === "number");
  if (any?.market) return Math.round(any.market * 100);
  return undefined;
}

function mapCard(card: PtcgCard): CatalogRecord {
  const setName = card.set?.name;
  const number = card.number;
  return {
    external_id: card.id,
    name: card.name,
    category: "tcg_single",
    image_url: card.images?.large ?? card.images?.small,
    market_price_cents: pickMarketCents(card),
    attributes: {
      game: "pokemon",
      foil: /Holo/i.test(card.subtypes?.join(",") ?? "") || /Holo/i.test(card.rarity ?? ""),
      set_name: setName,
      collector_number: number,
      rarity: card.rarity,
      hp: card.hp ? parseInt(card.hp) : undefined,
      types: card.types,
      artist: card.artist,
      release_year: card.set?.releaseDate ? parseInt(card.set.releaseDate.slice(0, 4)) : undefined,
    },
    external_ids: {
      pokemon_tcg: card.id,
      ...(card.set?.id ? { pokemon_set_id: card.set.id } : {}),
    },
  };
}

export const pokemonTcgAdapter: CatalogAdapter = {
  id: "pokemon_tcg",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Cheap query — first card in the catalog.
      const res = await fetch(`${BASE}/cards?pageSize=1`, { headers: authHeaders() });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { data?: PtcgCard[] };
      if (!Array.isArray(data.data)) {
        return { status: "degraded", latency_ms: latency, error: "Unexpected response shape" };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts) {
    const limit = Math.min(20, opts?.limit ?? 10);
    // The Pokémon TCG API uses query syntax with `name:`, `set.name:`, etc.
    const q = `name:"${query.replace(/"/g, "")}*"`;
    const url = `${BASE}/cards?q=${encodeURIComponent(q)}&pageSize=${limit}&orderBy=-set.releaseDate`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Pokémon TCG search failed: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: PtcgCard[] };
    return (data.data ?? []).map<CatalogSearchResult>((c) => ({
      external_id: c.id,
      title: `${c.name}${c.number ? ` · #${c.number}` : ""}`,
      subtitle: c.set?.name,
      image_url: c.images?.small,
      preview: mapCard(c),
    }));
  },

  async lookup(id) {
    const res = await fetch(`${BASE}/cards/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Pokémon TCG lookup failed: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: PtcgCard };
    return data.data ? mapCard(data.data) : null;
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
