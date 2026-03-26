# Scryfall API — TCG Pricing & Catalog Reference

**Role**: Free card catalog + pricing for Magic: The Gathering
**Auth**: None required (public API)
**Rate limit**: 50-100ms between requests (be respectful, no auth = no guarantee)
**Docs**: https://scryfall.com/docs/api

---

## Key Endpoints

### Card Search (fuzzy name match)
```
GET https://api.scryfall.com/cards/named?fuzzy={card_name}
```
Returns the most likely card. Perfect for trade-in pricing.

### Card Search (exact)
```
GET https://api.scryfall.com/cards/named?exact={card_name}&set={set_code}
```

### Card Search (query)
```
GET https://api.scryfall.com/cards/search?q={scryfall_query}
```
Supports Scryfall's full query syntax: `name:"Lightning Bolt" set:lea`

### Card by TCGPlayer ID
```
GET https://api.scryfall.com/cards/tcgplayer/{tcgplayer_id}
```

### Card by collector number
```
GET https://api.scryfall.com/cards/{set_code}/{collector_number}
```

## Pricing Data (included in every card response)

```json
{
  "prices": {
    "usd": "2.91",         // TCGPlayer market price (non-foil)
    "usd_foil": "5.50",    // TCGPlayer market price (foil)
    "usd_etched": null,    // Etched foil price
    "eur": "1.51",         // Cardmarket price
    "eur_foil": "3.00",    // Cardmarket foil price
    "tix": "0.02"          // MTGO price
  }
}
```

**This is TCGPlayer pricing for free.** No TCGPlayer API key needed.

## Key Fields for POS Integration

| Scryfall Field | POS Use |
|----------------|---------|
| `name` | Card name |
| `set_name` | Set name |
| `set` | Set code (3-letter) |
| `collector_number` | Collector number |
| `rarity` | common/uncommon/rare/mythic |
| `prices.usd` | Market price (non-foil) |
| `prices.usd_foil` | Market price (foil) |
| `tcgplayer_id` | Cross-reference to TCGPlayer |
| `image_uris.normal` | Card image URL |
| `image_uris.small` | Thumbnail image |

## Bulk Data (for offline cache)

```
GET https://api.scryfall.com/bulk-data
```
Returns links to downloadable JSON files:
- `default_cards` — every card printing (~300MB JSON, ~90K cards)
- `oracle_cards` — unique cards only (~30MB)
- `all_cards` — everything including tokens

**For offline trade-in pricing**: Download `default_cards` daily, cache in IndexedDB.
At ~300MB uncompressed, this is too big for every device. Better approach:
- Cache the cards the store actually sells (from their inventory)
- Cache recent lookups (already built in IndexedDB priceCache)
- Fall back to API for unknown cards when online

## Limitations

- **MTG only** — Scryfall doesn't cover Pokemon, Yu-Gi-Oh, etc.
- **No write access** — read-only catalog and pricing
- **Prices update daily** — not real-time intraday
- **No authentication** — no rate limit guarantee, be respectful
- **No official SLA** — community project, not a business API

## For Other TCGs

| TCG | Price Source | API |
|-----|-------------|-----|
| Pokemon | TCGPlayer (locked API) or pokemontcg.io | pokemontcg.io is free |
| Yu-Gi-Oh | TCGPlayer or ygoprodeck.com | ygoprodeck.com is free |
| Flesh and Blood | TCGPlayer | No free alternative |
| Lorcana | TCGPlayer | No free alternative |
| One Piece | TCGPlayer | No free alternative |
