# Afterroar Store Ops: V1 Metagame Intelligence System Specification
**Author:** Manus AI
**Date:** April 2, 2026

This document defines the technical and product specification for the V1 Metagame Intelligence System within Afterroar Store Ops. This system transforms raw transaction and event data into actionable metagame insights. V1 is strictly scoped: 100% anonymity, 0% external data sharing, built exclusively for FLGS operators.

## 1. Core Architecture and Philosophy

The Metagame Engine operates on two distinct tiers:
1.  **The Solo Model (Local-Only):** The engine analyzes a single store's data to provide insights specific to that store. All stores on the Intelligence OS tier receive this automatically. No data leaves the store's tenant boundary.
2.  **The Federated Model (Data-Sharing):** Stores explicitly opt-in to share anonymized, aggregated data with the Afterroar network. In return, they receive regional benchmarks, cross-store trend detection, and early demand signals.

**The Golden Rule of V1 Data Sharing:** Data shared by a store is used *only* to generate aggregated insights for other participating stores. It is never sold, licensed, or exposed to publishers, distributors, or any entity outside the Afterroar Store Ops ecosystem.

## 2. The Solo Model: Local Metagame Intelligence

The Solo Model operates entirely within the `store_id` boundary. It mines three data streams:
1.  **Retail Transactions:** TCG singles purchases, sealed product sales, and accessory buys.
2.  **Event Attendance:** Which players are attending which formats (e.g., FNM Draft vs. Commander Night).
3.  **Tournament Results:** Match records and final standings linked to player profiles.

### 2.1 Local Insights Generated

The engine synthesizes these streams to produce the following local insights:

*   **Format Health Tracking:** A rolling 30-day view of attendance and revenue by format (e.g., "Modern attendance is down 15%, but Modern singles revenue is up 20%").
*   **Card Clustering (Demand Sensing):** Identifies when multiple customers purchase the same specific cluster of cards within a short window, indicating a local deck-building trend.
*   **Predictive Restock Alerts:** "Three different players bought [Card X] and [Card Y] this week. You have 2 copies of [Card X] remaining. Consider restocking based on local archetype demand."
*   **Player Format Fingerprints:** Updates individual customer profiles with their dominant formats and archetypes, allowing staff to personalize recommendations.

### 2.2 Technical Implementation (Solo)

The Solo Engine relies on association rule mining (e.g., FP-Growth algorithm) applied to the `PosLedgerEntry` table, specifically filtering for TCG singles.

```typescript
// Conceptual Data Structure for Local Clusters
interface LocalCardCluster {
  store_id: string;
  cluster_id: string;
  cards: string[]; // Array of Scryfall/Pokémon IDs
  frequency: number; // How often this cluster was bought together
  last_seen: Date;
  implied_archetype?: string; // Optional mapping to known public archetypes
}
```

## 3. The Federated Model: Cross-Store Intelligence

The Federated Model is an opt-in network that aggregates data across participating stores to provide regional and national insights.

### 3.1 The Incentive Mechanic (The "Preview" Strategy)

To overcome the cold-start problem and incentivize data sharing, the system uses a preview mechanic:

1.  **Day 1-90:** A store uses the Solo Model. They see the value of local intelligence.
2.  **Day 91:** The dashboard displays a "locked" regional insight based on their local data. For example: "Your local Modern attendance is down 15%. Want to see if this is a regional trend or just your store? Opt-in to the Afterroar Data Network to unlock regional benchmarks."
3.  **The Opt-In:** The store agrees to the Data Sharing Charter (explicitly detailing the 100% anonymity guarantee). Their historical data is anonymized and added to the federated pool, and they instantly unlock all regional insights.

### 3.2 Federated Insights Generated

Participating stores gain access to the `Federated Metagame Dashboard`, which includes:

*   **Regional Format Benchmarks:** "Stores in your region average 18 players for FNM Draft. You average 12."
*   **Velocity Trend Detection:** "Sales of [Specific Sealed Set] are accelerating 30% faster in your region than the national average."
*   **Early Archetype Warnings:** "A new card cluster containing [Card A, B, C] is spiking across 15 stores in the network. This cluster is mapped to [New Archetype]. You have 0 copies of [Card A] in stock."

### 3.3 Privacy Architecture and Anonymization

The federated architecture relies on differential privacy principles to ensure no individual store's data can be reverse-engineered.

**1. Aggregation at the Edge:** Store Ops does not send raw transaction rows to the central intelligence server. It sends aggregated, time-bucketed summaries.
*   *Instead of:* "Customer X bought Card Y at Store Z at 2:00 PM."
*   *It sends:* "Store Z sold 4 copies of Card Y on [Date]."

**2. The K-Anonymity Threshold:** The central intelligence server will only generate a regional benchmark or trend signal if the data pool contains contributions from at least `K` distinct stores (e.g., `K=5`). If a region has only 3 participating stores, regional insights are suppressed to prevent stores from deducing each other's performance.

**3. Directional, Not Absolute, Reporting:** Federated insights are presented as percentages, indices, or directional trends, never as absolute raw numbers.

```typescript
// Conceptual API Contract: Store sending daily aggregated data to HQ
POST /api/hq/metagame/submit-daily-aggregation
{
  "store_id": "uuid",
  "date": "2026-04-01",
  "metrics": {
    "format_attendance": {
      "mtg_modern": 24,
      "pokemon_standard": 12
    },
    "card_velocity": [
      { "card_id": "scryfall_uuid", "quantity_sold": 4 },
      { "card_id": "pokemon_uuid", "quantity_sold": 12 }
    ],
    "detected_clusters": [
      { "cards": ["id1", "id2"], "frequency": 3 }
    ]
  }
}
```

## 4. The Moat

This V1 architecture establishes the Afterroar moat. Competitors like BinderPOS view cards purely as inventory SKUs. By analyzing cards as nodes in a behavioral graph (the Solo Model) and then aggregating that graph across a trusted network (the Federated Model), Afterroar provides demand sensing and operational intelligence that no single store could ever generate on its own. The promise of 100% anonymity ensures the trust required to build the network, and the preview mechanic ensures high opt-in rates.
