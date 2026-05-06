-- 0001_create_rec_tables.sql
-- ========================================================================
-- Mimir foundation schema -- Sprint 0.1
-- ========================================================================
-- Per design doc § 3.5 (knowledge graph nodes + edges) and § 7.1 (logging).
-- All tables use the rec_* prefix per SILO.md § 3 (schema namespace).
-- All CREATE statements use IF NOT EXISTS for idempotency.
-- This migration is ADDITIVE ONLY -- no DROP/ALTER/DELETE/TRUNCATE/INSERT.
--
-- Status: COMMITTED but NOT YET APPLIED to any database.
-- Application is deferred to Sprint 0.3 (depends on Sprint 0.2: migration runner).
-- ========================================================================


-- ========================================================================
-- NODE TABLES
-- ========================================================================

-- Games. The central node type. BGG-known games and internal (Game Kit
-- prototype) games coexist; `source` discriminates. `id` is bigint and
-- carries the BGG ID for source='bgg', a platform-internal id otherwise.
-- `attributes` jsonb is for per-game flags (e.g., is_expansion, is_promo)
-- that don't merit dedicated columns.
create table if not exists rec_game (
  id           bigint primary key,
  source       text not null,
  name         text not null,
  year         int,
  weight       numeric(3,2),
  min_players  int,
  max_players  int,
  min_minutes  int,
  max_minutes  int,
  min_age      int,
  bgg_rank     int,
  attributes   jsonb not null default '{}'::jsonb,
  cached_at    timestamptz not null default now()
);

-- Designers. Bridge nodes for designer-affinity scoring (designer_match
-- term in the v0 ranker; embeddings in later engines).
create table if not exists rec_designer (
  id     bigint primary key,
  name   text not null,
  source text
);

-- Mechanics (e.g., engine-builder, deck-builder, area-control). Bridge
-- nodes for mechanic-overlap scoring; central to cold-start similarity.
create table if not exists rec_mechanic (
  id     bigint primary key,
  name   text not null,
  source text
);

-- Themes (BGG boardgamefamily + boardgamecategory). Bridge nodes for
-- theme-overlap scoring.
create table if not exists rec_theme (
  id     bigint primary key,
  name   text not null,
  source text
);

-- Categories (e.g., GAME, EXPANSION, ACCESSORY). Higher-level
-- classification; mostly used for filtering rather than scoring.
create table if not exists rec_category (
  id     bigint primary key,
  name   text not null,
  source text
);

-- Players. Thin shadow of Passport User. Sync via outbox in Phase 1+.
-- passport_id is the canonical foreign key; id is for graph-internal use.
-- Empty at Phase 0 launch.
create table if not exists rec_player (
  id           bigint primary key,
  passport_id  text unique not null
);

-- Groups. Thin shadow of HQ GameGroup. Sync via outbox in Phase 1+.
-- Empty at Phase 0 launch.
create table if not exists rec_group (
  id           bigint primary key,
  hq_group_id  text unique not null
);

-- Nights. Thin shadow of HQ GameNight. Each game-night event is a node
-- so that played-edges can carry temporal context. Sync via outbox in
-- Phase 1+. Empty at Phase 0 launch.
create table if not exists rec_night (
  id           bigint primary key,
  hq_night_id  text unique not null,
  group_id     bigint,
  occurred_at  timestamptz
);

-- Stores. Thin shadow of POS Store. Sync via outbox in Phase 2+ (when
-- POS edges land). Empty at Phase 0 and Phase 1.
create table if not exists rec_store (
  id            bigint primary key,
  pos_store_id  text unique not null
);


-- ========================================================================
-- EDGE TABLE
-- ========================================================================

-- The graph itself. Typed, signed, timestamped, weighted edges between
-- any two node types. First-class records (not foreign-key tangles).
--
-- Phase 0 stores factual edges from BGG (designed-by, has-mechanic,
-- has-theme, in-category, expansion-of, family-of) and onboarding edges
-- (seed-loved, seed-noped). Phase 1+ adds behavioral edges (played,
-- voted-love, voted-nope, voted-bring, attended, brought, traded-in,
-- bought, etc.).
--
-- weight is stored RAW; decay is applied at query time so we can tune
-- half-lives per edge type without re-storing rows.
--
-- weight can be negative (e.g., voted-nope: -1.0; traded-in: -2.0).
--
-- context jsonb carries query-relevant attributes (night_id, store_id,
-- recap_id, etc.) that don't merit dedicated columns.
--
-- The unique constraint on (src_type, src_id, dst_type, dst_id, edge_type, ts)
-- prevents exact duplicates while allowing the same edge to repeat at
-- different timestamps (e.g., the same player played the same game at
-- multiple nights -- separate edges with different ts).
create table if not exists rec_edge (
  id          bigserial primary key,
  src_type    text not null,
  src_id      bigint not null,
  dst_type    text not null,
  dst_id      bigint not null,
  edge_type   text not null,
  weight      numeric not null default 1.0,
  ts          timestamptz not null default now(),
  context     jsonb not null default '{}'::jsonb,
  unique (src_type, src_id, dst_type, dst_id, edge_type, ts)
);

-- Outbound traversal: "what edges go from this node?" Common in PPR
-- and personalized recommendation queries.
create index if not exists rec_edge_src on rec_edge (src_type, src_id, edge_type);

-- Inbound traversal: "what edges point at this node?" Common in
-- "who else played this game?" queries.
create index if not exists rec_edge_dst on rec_edge (dst_type, dst_id, edge_type);

-- Time-bounded queries: "all played edges from the last 30 days."
-- Useful for recency-aware scoring and the offline eval window.
create index if not exists rec_edge_type_ts on rec_edge (edge_type, ts desc);

-- JSONB context queries: "all edges where context.night_id = X."
-- Useful when reasoning about a specific night or store.
create index if not exists rec_edge_context_gin on rec_edge using gin (context);


-- ========================================================================
-- LOGGING TABLES
-- ========================================================================
-- These are the most important tables in this file. If they're missing
-- or under-populated, future engines have nothing to learn from.
-- Per design doc § 7.

-- Every recommendation request -- full input context for offline eval.
-- request_id is uuid (generated app-side) so the candidate log and
-- feedback log can reference it without depending on insertion order.
create table if not exists rec_request_log (
  request_id      uuid primary key,
  ts              timestamptz not null default now(),
  surface         text not null,
  caller          jsonb not null,
  context         jsonb not null,
  options         jsonb not null,
  ranker_version  text not null
);

-- Every candidate considered for every request -- including ones we did
-- NOT show. Critical for offline eval (would the new ranker have
-- recommended a different game?) and for counterfactual analysis.
-- score_breakdown jsonb keeps per-feature contribution so we can debug
-- ranker behavior without re-running it.
create table if not exists rec_candidate_log (
  request_id        uuid not null references rec_request_log,
  game_id           bigint not null,
  rank              int not null,
  score             numeric not null,
  confidence        numeric,
  reason_codes      text[],
  score_breakdown   jsonb,
  primary key (request_id, game_id)
);

-- User interactions with recommendations. The training signal for every
-- future ranker. outcome (as text): 'shown' | 'clicked' | 'accepted'
-- | 'played' | 'rated' | 'bought' | 'dismissed' | 'ignored'.
-- outcome_value is for ratings (1-5), purchase amounts (cents), etc.
create table if not exists rec_feedback_log (
  id              bigserial primary key,
  request_id      uuid not null,
  game_id         bigint not null,
  ts              timestamptz not null default now(),
  outcome         text not null,
  outcome_value   numeric,
  outcome_context jsonb
);

-- Structured recap outcomes per (night, game, player). The training
-- data for the per-player fun model used by the simulator engine
-- (saga, future). All fields nullable -- recap UX should solicit but
-- not require them.
create table if not exists rec_recap_outcome (
  id                bigserial primary key,
  night_id          bigint not null,
  game_id           bigint not null,
  player_id         bigint not null,
  fun_rating        int,
  would_play_again  boolean,
  finished          boolean,
  won               boolean,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ========================================================================
-- END OF MIGRATION 0001
-- ========================================================================
-- Summary:
--   9 node tables: rec_game, rec_designer, rec_mechanic, rec_theme,
--                  rec_category, rec_player, rec_group, rec_night, rec_store
--   1 edge table: rec_edge (with 4 indexes)
--   4 logging tables: rec_request_log, rec_candidate_log,
--                     rec_feedback_log, rec_recap_outcome
-- Total: 14 tables, 4 indexes
-- ========================================================================
