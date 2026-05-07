-- 0002_extend_rec_tables.sql
-- ========================================================================
-- Mimir schema extension -- Sprint 1.0.15
-- ========================================================================
-- Adds four new node tables for the dimensions framework integration
-- (per docs/dimension-framework-integration.md and Manus's research
-- synthesis on tabletop recommendation graph dimensions).
--
-- Per SILO.md § 3, all tables remain rec_* prefixed.
-- All CREATE statements use IF NOT EXISTS for idempotency.
-- Additive only -- no DROP/ALTER/DELETE/TRUNCATE/INSERT.
--
-- These tables are additive node types in the existing graph. The
-- rec_edge table already supports any (src_type, dst_type, edge_type)
-- combination, so no edge-table changes are needed -- new edges just
-- reference the new node types via text.
--
-- Status: COMMITTED but NOT YET APPLIED to any production database.
-- Applied to a sandbox local Postgres in Sprint 1.0.15 to validate.
-- ========================================================================


-- ========================================================================
-- PERSONALITY PROFILE NODES
-- ========================================================================
-- Bartle archetypes (Achiever/Explorer/Socializer/Killer), Big Five OCEAN
-- traits, SDT needs (Competence/Autonomy/Relatedness), Yee motivational
-- clusters. One row per archetype/trait. Players have edges to these
-- with a numeric weight representing their score on that dimension.
-- Games have edges to these representing affinity for player profiles
-- that score high on that dimension.
create table if not exists rec_personality_profile (
  id          bigint primary key,
  framework   text not null,
  archetype   text not null,
  description text,
  source      text,
  unique (framework, archetype)
);


-- ========================================================================
-- EMOTION NODES
-- ========================================================================
-- MDA aesthetic categories (Sensation, Fantasy, Narrative, Challenge,
-- Fellowship, Discovery, Expression, Submission) plus emotional palette
-- entries (Tension, Humor, Triumph, Wonder, Nostalgia, Catharsis, etc).
-- Games induce emotions; players prefer emotions. Distinct from theme
-- (which is content) and mechanic (which is structure).
create table if not exists rec_emotion (
  id          bigint primary key,
  name        text not null,
  category    text,
  description text,
  source      text,
  unique (name)
);


-- ========================================================================
-- COGNITIVE PROFILE NODES
-- ========================================================================
-- Cognitive dimensions (working memory load, attention span, processing
-- speed, spatial reasoning, verbal/linguistic ability, social cognition).
-- Per Manus research § 1.4. Players have edges representing their
-- comfort/capacity on each dimension; games have edges representing
-- their requirement on each dimension.
create table if not exists rec_cognitive_profile (
  id          bigint primary key,
  dimension   text not null,
  description text,
  source      text,
  unique (dimension)
);


-- ========================================================================
-- CONTEXT TYPE NODES
-- ========================================================================
-- Recurring named contexts: party-night, family-night, hobby-group,
-- couples, educational, etc. Games have "optimal_for_context" edges
-- representing fit. Per Manus research § 2.5 and § 6.1.
--
-- Context type is a graph entity (per Manus's "context is not a filter,
-- it is a dimension" thesis), distinct from the per-request context
-- the recommend() API accepts. Per-request context is ephemeral; named
-- context types are recurring patterns.
create table if not exists rec_context_type (
  id              bigint primary key,
  name            text not null,
  description     text,
  min_players     int,
  max_players     int,
  min_minutes     int,
  max_minutes     int,
  attributes      jsonb not null default '{}'::jsonb,
  source          text,
  unique (name)
);


-- ========================================================================
-- END OF MIGRATION 0002
-- ========================================================================
-- Summary:
--   4 new node tables: rec_personality_profile, rec_emotion,
--                      rec_cognitive_profile, rec_context_type
--   0 new indexes (premature optimization; current scale doesn't need them)
--   0 changes to rec_edge (it already supports any node-type combination)
--
-- Total: 4 CREATE statements
-- ========================================================================
