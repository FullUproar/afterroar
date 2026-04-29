/**
 * Adapter dispatcher. Maps integration ids to their adapter implementations.
 *
 * Routes that need to call an adapter (the integrations dashboard for test-
 * connection, the inventory edit page for catalog lookups) import this
 * module and call `getAdapter(id)`.
 *
 * Sources without active adapters (TCGPlayer until partnership lands, GW
 * until a parsing adapter is built) return null.
 */

import { pokemonTcgAdapter } from "./pokemon-tcg";
import { openLibraryAdapter } from "./open-library";
import { drivethruRpgAdapter } from "./drivethrurpg";
import { comicvineAdapter } from "./comicvine";
import { upcdbAdapter } from "./upcdb";
import { openFoodFactsAdapter } from "./openfoodfacts";
import { discogsAdapter } from "./discogs";
import { musicBrainzAdapter } from "./musicbrainz";
import type { CatalogAdapter } from "./types";

const ADAPTERS: Record<string, CatalogAdapter> = {
  pokemon_tcg: pokemonTcgAdapter,
  openlibrary: openLibraryAdapter,
  drivethrurpg: drivethruRpgAdapter,
  comicvine: comicvineAdapter,
  upcdb: upcdbAdapter,
  openfoodfacts: openFoodFactsAdapter,
  // Future-vertical scaffolds — registered so testConnection works and the
  // dashboard can probe their reachability, even though `active: false`
  // hides them from the inventory edit's Lookup widget.
  discogs: discogsAdapter,
  musicbrainz: musicBrainzAdapter,
  // Scryfall + BGG already exist in the codebase under different paths;
  // when this dispatcher needs to call them, wrap them with the shared
  // CatalogAdapter shape and add here. For now the existing /api/catalog/*
  // routes call those legacy modules directly.
};

export function getAdapter(id: string): CatalogAdapter | null {
  return ADAPTERS[id] ?? null;
}

export function listAdapterIds(): string[] {
  return Object.keys(ADAPTERS);
}
