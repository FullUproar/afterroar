# Full Uproar Recommendation Engine — Design Doc

> **Source:** Architecture discussion, May 2026.
> **Status:** Design proposal, pre-implementation. Phase 0 scaffolding committed.
> **Caveat:** This doc was written from a strategic conversation, not by reading the live codebase. Where it references existing models/tables (e.g. `BoardGameMetadata`, `pos_catalog_products`), verify against the current schema before wiring up — the platform is a moving target. Flag inconsistencies as you encounter them.

---

## 0. TL;DR

We're building a recommendation engine that:

1. **Ships a useful v0 in days** using only BGG metadata and a 30-second onboarding flow. No internal data required.
2. **Grows into a genuinely differentiated system** as game-night plays, votes, trades, and store data accumulate — without re-architecting.
3. **Powers three distinct surfaces** off a shared core: HQ game-night picker, Passport personal library/next-game suggestions, POS store-inventory buy-side intelligence.
4. **Eventually beats BGG** not through cleverer ML, but by having data BGG structurally cannot collect: real attributed plays with group context, willingness votes, trade-in events (negative signal!), and cross-store velocity.

The architectural commitment: **the graph schema and the recommendation API contract are stable from day one. The ranker behind the API is swappable.** That's what lets us ship the dumbest possible thing first and evolve into a Monte Carlo social simulator without changing the surfaces or the data layer.

---

## 1. Strategic Framing

### 1.1 Domain split (already settled in platform architecture)

- **BGG** is the canonical source of game *metadata* (designer, mechanics, weight, year, etc.). External, untrusted dependency. Risk profile similar to the TCGPlayer rug-pull.
- **Passport** is the canonical source of player *identity and library*. Internal, critical. Hosts the BGG cache.
- **HQ** is the coordination tool for game *nights and rituals*. Generates play events; consumes player/library data via Passport.
- There is **no direct HQ ↔ BGG seam.** All BGG data flows through Passport. HQ may keep a thin local cache for render performance only.

### 1.2 Why a recommender is the right differentiator

BGG's own recommendation engine is famously weak. Their data is sparse self-selected ratings and lightly logged plays. Most discovery happens via geeklists, podcasts, BGA, and word of mouth.

Our network will produce data BGG cannot:

| Signal | BGG | Us |
|---|---|---|
| Game ratings | Sparse, self-selected, decontextualized | Per-night per-player ratings tied to real outcomes |
| Plays | Optional manual log, sparse | Auto-captured via game-night creation; group composition known |
| Group composition | None | Full ritual membership, attendance patterns, co-play graph |
| Negative signal | None (or buried in low ratings) | **Explicit trade-ins** — gold standard for "I'm done with this" |
| Willingness | None | "Bring / love / nope" votes per night |
| Commercial signal | None | POS sales velocity, regional demand, store inventory patterns |
| Player reputation | Anonymized | Passport identity, cross-store trust |

The asset is the data, not the algorithm. The algorithm just has to be good enough not to waste the data.

### 1.3 Three recommendation products from one engine

| Surface | Question | Primary feature signals |
|---|---|---|
| **HQ game-night picker** | "What should we play tonight, given this group, this time, this vibe, what we own?" | Group composition, willingness votes, recent plays, recap outcomes |
| **Passport library / next-game** | "What game should this player buy/wishlist next?" | Personal library, plays, ratings, group-derived taste |
| **POS buy-side intelligence** | "What should this store stock to maximize sell-through and margin?" | Regional velocity, customer demographics, similar-store outcomes, trade-in patterns |

All three implement the same `recommend(context) → ranked list` contract. They differ only in which features dominate scoring and which candidate pools they search over.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────┐
│  Surfaces                                  │
│  HQ picker · Passport library · POS buy-side│
└────────────────────┬───────────────────────┘
                     │
                     │  recommend(context) → [{game, score, explanation, ...}]
                     │  (STABLE CONTRACT — never changes)
                     │
┌────────────────────▼───────────────────────┐
│  Recommendation API                        │
│  Routes context to surface-appropriate     │
│  ranker; uniform request/response shape    │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│  Ranker (SWAPPABLE)                        │
│  v0: content similarity   ← ship first     │
│  v1: Personalized PageRank                 │
│  v2: learned embeddings + PPR              │
│  v3: Monte Carlo simulator                 │
│  v4: gene-graph w/ emergent dimensionality │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│  Knowledge Graph (STABLE SCHEMA from day 1)│
│  Heterogeneous property graph in Postgres  │
│  Nodes: Game, Designer, Mechanic, Theme,   │
│         Category, Player, Group, Night,    │
│         Store, Ritual                      │
│  Edges: typed + signed + timestamped       │
│         (later: vector-valued for gene-overlap) │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│  Sources                                   │
│  BGG metadata (today) · Onboarding seed    │
│  Plays + votes (HQ) · Trades + sales (POS) │
│  Recap outcomes (HQ, structured)           │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Logging layer (ALWAYS ON, from day 1)     │
│  Every request, candidate, score, outcome, │
│  interaction. The ranker's training set.   │
└────────────────────────────────────────────┘
```

The two stable layers are the **API contract** and the **knowledge graph schema**. Everything else is implementation that evolves.

---

## 3. The Knowledge Graph Layer

### 3.1 Why a property graph (and increasingly, a knowledge graph)

Game-night recommendations are an inherently relational problem. A player's taste is a function of their plays, their group's plays, the games they've voted to bring or skip, and games they've traded away. Mechanics, designers, and themes are bridge nodes that handle cold start.

Forcing this into a flat user-item matrix loses the structure that makes the recommendations interesting. A property graph keeps the structure first-class and makes it trivial to add new node/edge types as new signals come online.

Later engines (gene-graph, simulator) treat this as a full knowledge graph with vector-valued edges and multi-hop queries. The schema is forward-compatible with that — Phase 0 just doesn't exploit it yet.

### 3.2 Why Postgres, not Neo4j

For our scale (anticipated millions of edges, not billions), Postgres handles a property graph fine with two tables and good indexes. We get ACID, the existing operational stack, joins to relational data when needed, and no new infrastructure. When/if we outgrow it (later phases at network scale), we can introduce a graph DB or a vector store *behind the same ranker interface* without touching the API.

If KG-native query patterns become hot paths, the AGE Postgres extension provides Cypher syntax over the same tables. That's a Phase 1+ decision, not a Phase 0 one.

### 3.3 Node types

| Type | Source | Notes |
|---|---|---|
| `Game` | BGG | Canonical key = `(source, source_id)`. `source = 'bgg'` for BGG-known games; `source = 'internal'` for Game Kit custom games and prototypes. Future verticals can register new sources (`'discogs'`, `'isbn'`, `'gci'`). |
| `Designer` | BGG | |
| `Mechanic` | BGG | |
| `Theme` | BGG (`boardgamefamily`, `boardgamecategory`) | |
| `Category` | BGG | |
| `Player` | Passport | Empty at launch; grows with users. |
| `Group` | HQ | Empty at launch; grows with game-night creation. |
| `Night` | HQ | One node per game-night event. |
| `Store` | POS | Empty until store onboarding. |
| `Ritual` | HQ | Recurring game-night templates. |

### 3.4 Edge types (typed, signed, timestamped, weighted)

| Edge | Direction | Sign | Source | Phase available |
|---|---|---|---|---|
| `designed-by` | Game → Designer | factual | BGG | Phase 0 |
| `has-mechanic` | Game → Mechanic | factual | BGG | Phase 0 |
| `has-theme` | Game → Theme | factual | BGG | Phase 0 |
| `in-category` | Game → Category | factual | BGG | Phase 0 |
| `expansion-of` | Game → Game | factual | BGG | Phase 0 |
| `family-of` | Game → Family | factual | BGG | Phase 0 |
| `seed-loved` | Player → Game | + | Onboarding | Phase 0 |
| `seed-noped` | Player → Game | − | Onboarding | Phase 0 |
| `owns` | Player → Game | + | Passport library | Phase 1 |
| `wishlists` | Player → Game | + | Passport | Phase 1 |
| `member-of` | Player → Group | factual | HQ | Phase 1 |
| `attended` | Player → Night | factual | HQ | Phase 1 |
| `played` | Night → Game | factual | HQ | Phase 1 |
| `brought` | Player → Night, Game | factual | HQ | Phase 1 |
| `voted-bring` | Player → Game (per Night) | + | HQ | Phase 1 |
| `voted-love` | Player → Game | + | HQ | Phase 1 |
| `voted-nope` | Player → Game | − | HQ | Phase 1 |
| `won-with` | Player → Game | + (mild) | HQ recap | Phase 2 |
| `rated` | Player → Game (per Night) | signed (1–5) | HQ recap | Phase 2 |
| `traded-in` | Player → Game | **−−** (strong) | POS | Phase 2 |
| `bought` | Player → Game (at Store) | + | POS | Phase 2 |
| `stocked` | Store → Game | factual | POS | Phase 2 |
| `demoed` | Store → Game | + (mild) | POS | Phase 2 |
| `co-played` | Player ↔ Player | + | Derived from shared Nights | Phase 2 |

### 3.5 Postgres schema

```sql
-- Node tables (one per type, lean — most attributes live in JSONB)
create table rec_game (
  id           bigint primary key,         -- BGG ID where applicable, or internal
  source       text not null,              -- 'bgg' | 'internal'
  name         text not null,
  year         int,
  weight       numeric(3,2),               -- BGG weight 1-5
  min_players  int,
  max_players  int,
  min_minutes  int,
  max_minutes  int,
  min_age      int,
  bgg_rank     int,
  attributes   jsonb not null default '{}',
  cached_at    timestamptz not null default now()
);

create table rec_designer (id bigint primary key, name text not null, source text);
create table rec_mechanic (id bigint primary key, name text not null, source text);
create table rec_theme    (id bigint primary key, name text not null, source text);
create table rec_category (id bigint primary key, name text not null, source text);

-- Player/Group/Night/Store reference real platform tables; we keep a thin shadow
-- so the graph queries don't need to cross schemas. Sync via outbox or trigger.
create table rec_player (id bigint primary key, passport_id text unique not null);
create table rec_group  (id bigint primary key, hq_group_id text unique not null);
create table rec_night  (id bigint primary key, hq_night_id text unique not null, group_id bigint, occurred_at timestamptz);
create table rec_store  (id bigint primary key, pos_store_id text unique not null);

-- The edge table — first-class citizens, not foreign-key tangles
create table rec_edge (
  id          bigserial primary key,
  src_type    text not null,    -- 'game' | 'player' | 'group' | ...
  src_id      bigint not null,
  dst_type    text not null,
  dst_id      bigint not null,
  edge_type   text not null,    -- 'played' | 'voted-nope' | 'traded-in' | ...
  weight      numeric not null default 1.0,    -- can be negative
  ts          timestamptz not null default now(),
  context     jsonb not null default '{}',     -- {night_id, store_id, recap_id, ...}
  unique (src_type, src_id, dst_type, dst_id, edge_type, ts)
);

create index rec_edge_src on rec_edge (src_type, src_id, edge_type);
create index rec_edge_dst on rec_edge (dst_type, dst_id, edge_type);
create index rec_edge_type_ts on rec_edge (edge_type, ts desc);
create index rec_edge_context_gin on rec_edge using gin (context);
```

### 3.6 Edge weight & decay

Every edge has a weight that the ranker interprets. A `played` edge from 2 years ago should not influence recommendations as strongly as one from last month. Don't bake decay into the stored weight — keep raw weight stable and apply decay at query time:

```
effective_weight(edge) = edge.weight * exp(-λ * (now - edge.ts) / half_life)
```

Different edge types may want different half-lives (`played`: 6 months; `traded-in`: 18 months; `seed-loved`: never decays).

### 3.7 Game ID namespace reconciliation

BGG IDs as canonical key for BGG-known games. Internal IDs (with `source = 'internal'` discriminator) for Game Kit custom games and prototypes. Passport is the source of truth for the mapping. The graph just stores `(source, id)` and treats them uniformly.

This also makes future migrations to other catalogs (gci-db, Discogs for vinyl, ISBN for books in non-FLGS verticals) a swap of `source` values rather than a schema change.

---

## 4. The Recommendation API

### 4.1 Request

```typescript
type RecommendRequest = {
  // Who is asking and why
  surface: 'hq_picker' | 'passport_library' | 'pos_buy_side';
  caller: { player_id?: string; group_id?: string; store_id?: string };

  // Context for ranking
  context: {
    players?: string[];           // Passport IDs in attendance
    minutes_available?: number;
    desired_weight?: [number, number];   // BGG-scale range
    desired_player_count?: number;
    vibe?: string[];              // free-form tags: 'spooky', 'casual', 'cutthroat'
    time_of_day?: 'lunch' | 'evening' | 'late_night';
    seed_games?: number[];        // "more like these"
    must_own?: string[];          // Passport IDs whose libraries constrain candidates
  };

  // Shape of the result
  options: {
    limit?: number;               // default 10
    candidate_pool?: 'all' | 'owned' | 'in_store' | 'wishlist';
    diversify?: boolean;          // default true (avoid 5 Stonemaier games in a row)
    explain?: 'none' | 'short' | 'rich';   // default 'short'
    exclude?: number[];
    include_low_confidence?: boolean;
  };
};
```

### 4.2 Response

```typescript
type RecommendResponse = {
  request_id: string;             // logged; used by feedback endpoint
  ranker_version: string;         // 'content-similarity-0.1' | 'ppr-0.1' | etc
  results: Array<{
    game_id: number;
    game_name: string;
    score: number;                // 0..1, calibrated within ranker version
    confidence: number;           // 0..1, rises with data density
    explanation: {
      reason_codes: string[];     // ['mechanic_match', 'group_history', 'similar_to_seed']
      natural_language: string;   // human-readable, surface-formatted
      contributors?: Array<{      // for 'rich' explanations
        feature: string;
        weight: number;
        source: string;           // 'bgg' | 'group_plays' | 'recap_data'
      }>;
    };
    diagnostics?: {               // returned if `explain: 'rich'`, hidden in UI
      candidate_rank: number;
      score_breakdown: Record<string, number>;
    };
  }>;
};
```

### 4.3 Feedback endpoint (critical for training)

```typescript
POST /recommend/feedback
{
  request_id: string;
  game_id: number;
  outcome: 'shown' | 'clicked' | 'accepted' | 'played' | 'rated' | 'bought' | 'dismissed' | 'ignored';
  outcome_value?: number;         // rating, purchase amount, etc
  outcome_context?: object;
}
```

Every interaction with a recommendation is feedback. **This endpoint exists from day one.** Without it, future engines have nothing to learn from.

---

## 5. The Ranker Layer (swappable)

### 5.1 v0 — Content similarity (this engine)

Pure metadata-based scoring. No internal data needed.

**Algorithm:**
```
score(candidate, context) = 
    w1 * mechanic_overlap(candidate, seed_or_taste_vector)
  + w2 * theme_overlap(candidate, seed_or_taste_vector)
  + w3 * weight_similarity(candidate.weight, desired_weight)
  + w4 * player_count_fit(candidate, context.desired_player_count)
  + w5 * length_fit(candidate, context.minutes_available)
  + w6 * designer_match(candidate, taste_vector)
  + w7 * quality_prior(candidate.bgg_rank)
  - w8 * already_played_recently_penalty
  - w9 * seed_noped_penalty(candidate, taste_vector)
```

**Taste vector construction (Phase 0):**
- From onboarding: `seed-loved` games contribute positively, `seed-noped` games contribute negatively, in mechanic/theme/designer feature space.
- From seed games in request: weighted toward those.

**Hand-tune the weights initially.** Don't reach for ML. With ~7 onboarding signals and rich BGG metadata, hand-tuned weights give surprisingly good recommendations and are completely interpretable.

**Diversification:** Maximal Marginal Relevance (MMR) on top-K to prevent monocultures (5 Stonemaier games in a row).

**Explanation generation:** rule-based templates. The reason codes map to natural-language fragments:
- `mechanic_match` → "shares engine-building and set collection with games you loved"
- `length_fit` → "plays in your 90-minute window"
- `weight_match` → "around the complexity you tend to enjoy"

### 5.2 v1 — Personalized PageRank (separate engine, future)

Once we have actual `played`, `voted-love`, `voted-nope`, `traded-in` edges in the graph, PPR is dramatically better than content similarity for the surfaces that have a player or group context. Will live in `rec-engines/ppr/` when scaffolded.

### 5.3 v2 — Learned embeddings + PPR fallback (separate engine, future)

When edge density warrants. Will live in `rec-engines/embeddings/`.

### 5.4 v3 — The Monte Carlo Simulator (separate engine, future)

Forward simulation of game-night outcomes with per-player fun models and stochastic events. Will live in `rec-engines/simulator/`.

### 5.5 v4 — Gene-graph with emergent dimensionality (separate engine, future)

Knowledge graph with vector-valued edges representing gene-overlap. Open-ended dimensionality with speciation/deprecation. Will live in `rec-engines/gene-graph/`.

### 5.6 v5+ — Federated cross-store learning (network-scale, future)

Groups with thin local data borrow signal from similar groups in the network. Aggregate-only sharing — no individual data leaves Passport boundaries.

---

## 6. The Phased Build

### 6.1 Phase 0 — This engine, foundation

**Build (in this engine):**
- Postgres schema (sections 3.5)
- BGG metadata import script for top ~5,000 games (one-time, refreshable)
- Ranker v0 (section 5.1)
- API endpoints: `POST /recommend`, `POST /recommend/feedback`
- Logging tables (section 7)
- Onboarding flow seed-edge ingestion endpoint
- Wire to one HQ surface as the v0 game picker via the federation API

**Skip for now:**
- Player/group node sync (the schema exists, the data doesn't)
- PPR machinery (separate engine)
- Embeddings (separate engine)
- Recap structured fields (but spec them — see section 9)

### 6.2 Phase 1 — First ~50 active users

**Trigger:** real users creating game nights and casting votes.

**Build (in `rec-engines/ppr/`):**
- Sync `Player`, `Group`, `Night` from HQ into the graph (via outbox/trigger)
- Wire HQ vote events to `voted-love`, `voted-nope`, `voted-bring` edges
- Wire night creation to `played`, `attended`, `brought` edges
- Implement PPR ranker
- A/B framework: rec router (production-side) sends same request to both engines, logs both, returns one

### 6.3 Phase 2 — ~500 users / few thousand plays

**Trigger:** edge density makes embeddings worth training.

### 6.4 Phase 3 — Recap data flowing structured

**Trigger:** months of structured recap data (per-player fun ratings, outcomes).

### 6.5 Phase 4 — Multi-store network

---

## 7. Logging Spec (the most important section)

**This is the part that, if skipped, makes future engines impossible.** Build it day one.

### 7.1 Tables

```sql
create table rec_request_log (
  request_id    uuid primary key,
  ts            timestamptz not null default now(),
  surface       text not null,
  caller        jsonb not null,
  context       jsonb not null,
  options       jsonb not null,
  ranker_version text not null
);

create table rec_candidate_log (
  request_id    uuid not null references rec_request_log,
  game_id       bigint not null,
  rank          int not null,
  score         numeric not null,
  confidence    numeric,
  reason_codes  text[],
  score_breakdown jsonb,
  primary key (request_id, game_id)
);

create table rec_feedback_log (
  id            bigserial primary key,
  request_id    uuid not null,
  game_id       bigint not null,
  ts            timestamptz not null default now(),
  outcome       text not null,
  outcome_value numeric,
  outcome_context jsonb
);

-- Recap structured outcomes (the simulator's training data)
create table rec_recap_outcome (
  id            bigserial primary key,
  night_id      bigint not null,
  game_id       bigint not null,
  player_id     bigint not null,
  fun_rating    int,             -- 1..5, optional
  would_play_again boolean,
  finished      boolean,
  won           boolean,
  notes         text,
  created_at    timestamptz not null default now()
);
```

### 7.2 What gets logged

- Every `recommend()` request (full context).
- Every candidate considered (not just top-K returned). For training, you need the things you *didn't* show too.
- Every score breakdown so we can debug ranker behavior.
- Every interaction: `shown`, `clicked`, `accepted`, `played`, `rated`, `dismissed`.
- Every recap outcome with structured fields (even if optional in the UI).

### 7.3 What this enables

- **Offline eval:** recompute scores with new ranker against logged requests, measure rank correlation.
- **Online A/B:** run multiple rankers in shadow mode, compare CTR / play-through.
- **Future engine training:** recap outcomes are exactly the signal the per-player fun model needs.
- **Debug:** "why did Cascadia get recommended for that night?" — the score breakdown is right there.

---

## 8. Cold-Start Onboarding

### 8.1 The 30-second flow

When a new player joins HQ (or links Passport):

1. **"Pick 5 games you love."** Show a curated grid of ~30 popular games across genres/weights. Let them search if their faves aren't shown.
2. **"Pick 2 you can't stand or won't play."** Smaller grid, same source. The negative signal is gold.
3. **Optional: "Tell us about your favorite game night."** Free-form one-liner.

7 edges = enough seed for v0 content similarity to feel useful. Skippable for users who want to start with explicit picks instead.

### 8.2 The seed game pool

Curate a list of ~50–100 games that:
- Span weight categories (party → light → medium → heavy)
- Span mechanics (engine, deduction, area control, wargame, etc.)
- Span themes (fantasy, sci-fi, abstract, train, civ)
- Are widely known enough that most respondents have an opinion

Refresh quarterly based on what's actually being played in your network.

### 8.3 Group onboarding

When a new group is created in HQ, derive an initial group profile by aggregating member taste vectors. Decay individual contribution by recency of joining the group (founding members weighted higher). Phase 1+ replaces this with learned group embedding.

---

## 9. Recap Data Schema (decide now, capture from day 1)

Recap UX should solicit these fields per game per night, all optional:

| Field | Type | Why it matters |
|---|---|---|
| `fun_rating` | 1–5 stars per player | Trains per-player fun model |
| `would_play_again` | bool per player | Cleaner signal than rating; high info |
| `finished` | bool | "Game ended in salt" is a real outcome |
| `winner_player_id` | nullable | "Who tends to win" affects future-night dynamics |
| `length_actual_minutes` | int | Calibrate the length-fit feature |
| `notes` | text | LLM extraction later for sentiment, "Brad got salty," etc |

If recaps stay freeform-text-only, you'll pay LLM extraction tax forever. If they're structured-with-optional-freeform from day one, you're golden.

---

## 10. Differentiation: What BGG Can't Do

| BGG | Us |
|---|---|
| "Games similar to X" by community curation | Recommendations conditioned on *your specific group, on this specific night* |
| Static rec lists | Counterfactuals: "if you wait 3 weeks, this becomes a 0.91 rec" |
| No negative signal | Trade-ins as first-class negative edges |
| Anonymous ratings | Plays attributed to identified players in identified groups, with outcomes |
| No commercial signal | "This will sell in your region" for FLGS owners |
| One-shot recommendations | Group health diagnostics: "this player's fun is trending down" |
| Generic | Federated learning across the FLGS network |

---

## 11. Credo-Aligned Constraints

The Afterroar Credo imposes structural requirements on the rec engine that aren't optional features:

1. **Data transparency surface.** Every player must be able to see what's known about them, what edges they have in the graph, and what's feeding their recommendations. They must be able to delete any of it.
2. **Audit-by-construction.** Recommendations are explainable through the path that produced them. No "model says so" black-box explanations.
3. **No preferential access.** Full Uproar Games (as a publisher in the federation) does not get preferential placement in recommendations. The rec engine treats FU games like any other game.
4. **Consent-gated cross-app reads.** The federation API enforces consent at the query layer. The rec engine reads only what the player has consented to share with the calling app.

These are launch requirements, not future features.

---

## 12. Open Decisions / Things to Resolve Before Building

1. **Recap structured field set.** Section 9 is a proposal. Confirm before HQ ships its recap UI v1, because retrofitting fields onto recaps that already happened is painful.
2. **Seed game pool curation.** Use BGG top 200 with diversity heuristics initially, but a human pass would be better.
3. **BGG cache TTL strategy.** Static fields (designer, mechanics): cache months. Volatile (rank, ratings): cache hours-days or skip caching. Confirm against current BGG API rate limits.
4. **Hand-tuned weight values for the v0 ranker.** Initial values to be set in implementation, refined via offline eval.
5. **Confidence score calibration.** What threshold below which we return "insufficient data" instead of a list.
6. **Rec router (production-side) design.** Separate from this engine. Probably lives in `apps/me` or a new `packages/rec-router/`. Owns A/B distribution, feature flag enforcement, caller authentication.

---

## 13. Reference: subtle-wrongness assertions every engine must pass

(Per `../SILO.md` § 7.)

- **Negative-signal propagation:** if a player has a `voted-nope` or `traded-in` edge to game X, X must not appear in their next 10 recs.
- **Constraint respect:** player count, length, exclusion lists are honored.
- **Diversity:** no single designer dominates the top-K (cap at 2 of any single designer in top 10).
- **Cold-start safety:** insufficient-data inputs produce a low-confidence response, not nonsense.
- **Stale-cache safety:** results carry a `computed_at` and respect invalidation when underlying signals change.

---

## 14. Glossary

- **PPR** — Personalized PageRank. Random walk with restart, biased toward a personalization vector. Classic graph-based recommendation algorithm. Lightweight, interpretable, no training.
- **Soft-min aggregator** — Group fun aggregation that weights the unhappiest player more than the happiest. Captures the reality that one bored player drags the night.
- **MMR** — Maximal Marginal Relevance. Greedy diversification: pick the top item, then iteratively pick the next item that maximizes (relevance − λ · max_similarity_to_already_picked).
- **Outbox pattern** — Async write-to-other-service via durable event log. Already used in the platform for HQ ↔ Store Ops sync. Apply same pattern for cross-service edge syncing.
- **Gene** — A learned, emergent dimension of the embedding space that has interpretable meaning. Used in v4+ engine.
- **Speciation** — The process by which a single gene splits into multiple when it captures multiple distinguishable sub-concepts. v4+ engine.
