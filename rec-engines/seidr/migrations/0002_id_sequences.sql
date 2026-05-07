-- 0002_id_sequences.sql
-- ========================================================================
-- Seidr id-sequence fix -- Sprint 1.0.31 (post-deployment)
-- ========================================================================
-- 0001 declared `id bigint primary key` for all three seidr tables but
-- did not attach a sequence, so INSERTs without an explicit id NULL out.
-- This was caught when seeding the 225-game corpus on 2026-05-06.
--
-- Mimir's tables (0001 there) use `bigserial`; seidr's didn't. This
-- migration brings seidr in line by adding a sequence per table and
-- setting it as the column default.
--
-- All sequences and ALTER COLUMN targets remain in rec_seidr_* namespace.
-- Idempotent.
-- ========================================================================

create sequence if not exists rec_seidr_game_profile_id_seq;
alter table rec_seidr_game_profile
  alter column id set default nextval('rec_seidr_game_profile_id_seq');
alter sequence rec_seidr_game_profile_id_seq
  owned by rec_seidr_game_profile.id;

create sequence if not exists rec_seidr_player_profile_id_seq;
alter table rec_seidr_player_profile
  alter column id set default nextval('rec_seidr_player_profile_id_seq');
alter sequence rec_seidr_player_profile_id_seq
  owned by rec_seidr_player_profile.id;

create sequence if not exists rec_seidr_response_id_seq;
alter table rec_seidr_response
  alter column id set default nextval('rec_seidr_response_id_seq');
alter sequence rec_seidr_response_id_seq
  owned by rec_seidr_response.id;
