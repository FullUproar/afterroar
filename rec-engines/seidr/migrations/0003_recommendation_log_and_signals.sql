-- 0003_recommendation_log_and_signals.sql
-- ========================================================================
-- Seidr feedback + event log -- Cycle 2
-- ========================================================================
-- Two new tables to close the rec-quality loop:
--   - rec_seidr_recommendation_event: every rec request (anonymous or signed-in)
--   - rec_seidr_user_game_signal:     per-game user feedback (thumbs/owned/loved)
--
-- Why log every rec request:
--   We can't tell if recs are good without tying user-game signals back to
--   the recommendation that produced them. The event row stores the profile
--   snapshot, the engines+candidates considered, and the ordered game ids
--   that were returned, so quality analysis can join "user said thumbs-up
--   on game X" back to "X was rank 3 of 12 from this profile/mood/filter."
--
-- Why per-game signals (not just thumbs):
--   "I own this", "I've loved this", "I've never heard of this", and "this
--   isn't for me" all carry different training signal. Cramming them into
--   thumbs-up/down loses the learning. The kind enum is open-ended.
--
-- Anonymous-friendly:
--   passport_id is nullable. Anonymous quiz-takers can leave a thumbs
--   reaction in-session via a one-time anon_session_id (a uuid generated
--   in the browser, stored in localStorage). On Passport claim, we can
--   migrate signals over by anon_session_id.
--
-- All CREATE statements use IF NOT EXISTS for idempotency.
-- Additive only -- no DROP/ALTER/DELETE/TRUNCATE/INSERT.
-- ========================================================================


-- ========================================================================
-- RECOMMENDATION EVENT LOG
-- ========================================================================
-- One row per /api/quiz/recommend or /api/recs/games hit. Stored eagerly
-- so we have a stable id to attach user_game_signal rows to.
--
-- profile_snapshot: jsonb of the dim_vector that produced this rec set
--   (after mood_delta is applied). Lets us reproduce the rec ordering
--   even if the player's persisted profile changes later.
-- mood_delta: the delta applied (if any). For provenance.
-- filters: the year/subdomain filters applied (if any). For provenance.
-- candidates_considered: how many game profiles the engine had to pick from.
-- engines_ran / engines_skipped: which engines participated.
-- recommendations: jsonb array of {game_id, rank, score, contributions...}
--   Captures the served list so a thumbs-down 30 days later can identify
--   which exact rec it was responding to.
-- source: 'quiz' | 'recs_api' | etc.
-- anon_session_id: present when passport_id is null. uuid from the browser.
create table if not exists rec_seidr_recommendation_event (
  id                    bigint primary key,
  passport_id           text,
  anon_session_id       text,
  source                text not null,
  profile_snapshot      jsonb not null,
  mood_delta            jsonb,
  filters               jsonb,
  candidates_considered int,
  engines_ran           jsonb,
  engines_skipped       jsonb,
  recommendations       jsonb not null,
  created_at            timestamptz not null default now()
);

create sequence if not exists rec_seidr_recommendation_event_id_seq;
alter table rec_seidr_recommendation_event
  alter column id set default nextval('rec_seidr_recommendation_event_id_seq');
alter sequence rec_seidr_recommendation_event_id_seq
  owned by rec_seidr_recommendation_event.id;


-- ========================================================================
-- USER GAME SIGNAL
-- ========================================================================
-- Per-(user|anon, game) tuple of explicit feedback. Multiple signals on
-- the same game are allowed (own + loved + thumbs_up are independent).
-- Latest wins for any single (kind) — the unique index enforces that
-- (passport_id|anon_session_id, game_id, kind) collapses to one row.
--
-- kind:
--   'thumbs_up'         -- I like this rec
--   'thumbs_down'       -- I don't like this rec
--   'owned'             -- I own this game
--   'loved'             -- I've played this and loved it
--   'meh'               -- I've played this and don't care
--   'never_heard_of'    -- New to me (potentially a good rec — surfaces unknowns)
--   'tried_disliked'    -- I've played this and don't like it
--
-- recommendation_event_id is the rec event that surfaced this game (when
-- known — manual feedback outside of a rec session may leave it null).
--
-- weight: optional float for use as training signal. Currently always 1.
create table if not exists rec_seidr_user_game_signal (
  id                       bigint primary key,
  passport_id              text,
  anon_session_id          text,
  game_id                  bigint not null,
  kind                     text   not null,
  recommendation_event_id  bigint references rec_seidr_recommendation_event(id),
  weight                   real   not null default 1.0,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create sequence if not exists rec_seidr_user_game_signal_id_seq;
alter table rec_seidr_user_game_signal
  alter column id set default nextval('rec_seidr_user_game_signal_id_seq');
alter sequence rec_seidr_user_game_signal_id_seq
  owned by rec_seidr_user_game_signal.id;


-- ========================================================================
-- INDEXES
-- ========================================================================
-- Look up a passport's full event history (most recent first).
create index if not exists rec_seidr_recommendation_event_passport_idx
  on rec_seidr_recommendation_event (passport_id, created_at desc)
  where passport_id is not null;

-- Look up an anon session's events (for claim-on-passport-creation).
create index if not exists rec_seidr_recommendation_event_anon_idx
  on rec_seidr_recommendation_event (anon_session_id, created_at desc)
  where anon_session_id is not null;

-- Per-(passport, game, kind) uniqueness: a single thumbs-up per game
-- per user. Re-thumb-upping is idempotent (the upsert noops or refreshes
-- updated_at). Same for anon.
create unique index if not exists rec_seidr_user_game_signal_passport_unique
  on rec_seidr_user_game_signal (passport_id, game_id, kind)
  where passport_id is not null;

create unique index if not exists rec_seidr_user_game_signal_anon_unique
  on rec_seidr_user_game_signal (anon_session_id, game_id, kind)
  where anon_session_id is not null;

-- Look up all signals for a game (for aggregate "people loved this" counters).
create index if not exists rec_seidr_user_game_signal_game_idx
  on rec_seidr_user_game_signal (game_id, kind);


-- ========================================================================
-- END OF MIGRATION 0003 (seidr)
-- ========================================================================
