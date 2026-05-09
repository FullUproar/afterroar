-- 0001_saga_tables.sql
-- ========================================================================
-- Saga engine schema -- Phase-2 scaffold
-- ========================================================================
-- Saga is the simulator engine: predicts per-player fun for a candidate
-- game by Monte-Carlo-sampling outcomes from a per-game outcome model
-- and a per-player fun model. Per HEIMDALL.md + saga/docs/, the engine
-- requires substantial training data before it can be activated:
--   - ≥3000 per-player recap observations
--   - ≥200 unique players represented
--   - ≥6 months of recap collection
--
-- Until then, saga returns empty + "data threshold not met" from
-- /api/recs/games. THIS migration creates the tables that accumulate
-- the training data right now — every recap that lands counts toward
-- the activation threshold. We're not waiting; we're collecting.
--
-- Per SILO.md § 3, all tables remain rec_* prefixed; engine-specific
-- tables additionally carry the engine name (rec_saga_*).
--
-- All CREATE statements use IF NOT EXISTS for idempotency.
-- Additive only -- no DROP/ALTER/DELETE/TRUNCATE/INSERT.
-- ========================================================================


-- ========================================================================
-- PER-GAME RECAP OBSERVATION
-- ========================================================================
-- One row per game-night-game played. Captures the game-level outcome
-- features that feed into the per-game outcome model (kingmaker rate,
-- runaway-leader rate, AP trigger rate, etc).
--
-- recap_id ties back to HQ's recap record so we can rejoin if needed
-- without making this table the source of truth — HQ owns the recap;
-- we mirror the saga-relevant fields here for query independence.
--
-- notable_events: jsonb of structured tags per recap-as-training-data.md.
-- Currently expected: kingmaker_event, runaway_leader, comeback, ap_event,
-- memorable_moment, eliminated_player_event, table_break. New tags can
-- be added without schema change.
create table if not exists rec_saga_recap_observation (
  id                    bigint primary key,
  recap_id              text not null,
  played_at             timestamptz not null,
  game_id               bigint not null,
  group_size            int not null,
  group_player_ids      jsonb not null,
  duration_min          int,
  did_game_finish       boolean not null default true,
  winner_player_id      text,
  winner_score          real,
  loser_scores          jsonb,
  score_decisive        boolean,
  notable_events        jsonb not null default '{}'::jsonb,
  play_context          jsonb not null default '{}'::jsonb,
  store_id              text,
  created_at            timestamptz not null default now(),
  -- Edits within 30 days per recap-data-spec; we version observations
  -- by appending new rows rather than mutating, so this column tracks
  -- which row supersedes which. NULL = active version.
  superseded_by         bigint,
  unique (recap_id, game_id)
);

create sequence if not exists rec_saga_recap_observation_id_seq;
alter table rec_saga_recap_observation
  alter column id set default nextval('rec_saga_recap_observation_id_seq');
alter sequence rec_saga_recap_observation_id_seq
  owned by rec_saga_recap_observation.id;


-- ========================================================================
-- PER-PLAYER PER-GAME RECAP OBSERVATION
-- ========================================================================
-- One row per (player, game-night-game). The headline observation for
-- saga's per-player fun model: fun_rating is the label we're regressing
-- against. would_play_again gives a coarser-grained reinforcement signal.
--
-- player_role_outcome: text enum-ish: 'won', 'second', 'mid', 'last',
-- 'eliminated_at_turn_N'. Stored as text for forward-compatibility with
-- new role types.
create table if not exists rec_saga_per_player_observation (
  id                    bigint primary key,
  recap_observation_id  bigint not null references rec_saga_recap_observation(id),
  player_id             text not null,
  player_role_outcome   text,
  fun_rating            int not null check (fun_rating between 1 and 5),
  would_play_again      text,
  engagement_during_play int check (engagement_during_play between 1 and 5),
  regrets               text,
  memorable_for_player  boolean not null default false,
  created_at            timestamptz not null default now(),
  superseded_by         bigint,
  unique (recap_observation_id, player_id)
);

create sequence if not exists rec_saga_per_player_observation_id_seq;
alter table rec_saga_per_player_observation
  alter column id set default nextval('rec_saga_per_player_observation_id_seq');
alter sequence rec_saga_per_player_observation_id_seq
  owned by rec_saga_per_player_observation.id;


-- ========================================================================
-- PER-PLAYER FUN MODEL (lazy — populated when training runs)
-- ========================================================================
-- Per recap-as-training-data.md, fitted parameters per player. Empty
-- until training cycles begin (post-activation). One row per
-- (player_id, model_version).
--
-- coefficients: jsonb of fitted weights — baseline_offset + per-dim
-- weight contributions + interaction-term coefficients. Schema is
-- model-version-dependent; the jsonb is intentionally loose so we
-- can iterate without migrations.
create table if not exists rec_saga_player_fun_model (
  id                    bigint primary key,
  player_id             text not null,
  model_version         int not null default 1,
  coefficients          jsonb not null,
  fitted_at             timestamptz not null default now(),
  fit_observations      int not null,
  fit_quality           jsonb,
  superseded            boolean not null default false,
  unique (player_id, model_version)
);

create sequence if not exists rec_saga_player_fun_model_id_seq;
alter table rec_saga_player_fun_model
  alter column id set default nextval('rec_saga_player_fun_model_id_seq');
alter sequence rec_saga_player_fun_model_id_seq
  owned by rec_saga_player_fun_model.id;


-- ========================================================================
-- PER-GAME OUTCOME MODEL (lazy — populated when training runs)
-- ========================================================================
-- Per game, the parameters that drive sample_outcome() in the simulator.
-- Beta posteriors for kingmaker rate, runaway leader rate, AP trigger
-- rate etc, and lognormal fit for duration. Stored as jsonb so the
-- shape can iterate.
--
-- Pre-activation: this table stays empty. Post-activation, training
-- jobs populate it from the recap observation tables above.
create table if not exists rec_saga_game_outcome_model (
  id                    bigint primary key,
  game_id               bigint not null,
  model_version         int not null default 1,
  parameters            jsonb not null,
  fitted_at             timestamptz not null default now(),
  fit_observations      int not null,
  fit_quality           jsonb,
  superseded            boolean not null default false,
  unique (game_id, model_version)
);

create sequence if not exists rec_saga_game_outcome_model_id_seq;
alter table rec_saga_game_outcome_model
  alter column id set default nextval('rec_saga_game_outcome_model_id_seq');
alter sequence rec_saga_game_outcome_model_id_seq
  owned by rec_saga_game_outcome_model.id;


-- ========================================================================
-- INDEXES
-- ========================================================================
-- Activation-threshold queries: count distinct players + total observations.
create index if not exists rec_saga_per_player_observation_player_idx
  on rec_saga_per_player_observation (player_id);
-- Per-game training queries: pull all observations for a game.
create index if not exists rec_saga_recap_observation_game_idx
  on rec_saga_recap_observation (game_id) where superseded_by is null;
-- Recency-window scans for retraining triggers.
create index if not exists rec_saga_recap_observation_played_at_idx
  on rec_saga_recap_observation (played_at desc) where superseded_by is null;


-- ========================================================================
-- END OF MIGRATION 0001 (saga)
-- ========================================================================
-- Summary:
--   4 new engine-specific tables for the simulator engine
--   4 sequences (one per primary key)
--   3 indexes
--   0 changes to non-saga tables
-- ========================================================================
