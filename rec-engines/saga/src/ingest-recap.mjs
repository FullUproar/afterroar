// ingest-recap.mjs
// ============================================================================
// Recap → Saga observation writer. Called from the HQ → afterroar.me
// recap webhook (or whatever pipeline ends up moving recap data into
// the seidr/saga DB). Writes one rec_saga_recap_observation row + N
// rec_saga_per_player_observation rows per game played in the recap.
//
// Idempotency: rec_saga_recap_observation is unique on (recap_id,
// game_id), so re-ingesting the same recap is a no-op via ON CONFLICT.
// Per-player rows are unique on (recap_observation_id, player_id) —
// re-ingest replaces (via the supersede pattern, never destructive
// UPDATE — we keep history).
//
// All writes happen in a single transaction so a partial failure
// can't leave the DB in a "game observation written but no per-player
// rows" half-state.
//
// SHAPE EXPECTED FROM HQ:
//   {
//     recap_id: string,                  // HQ's authoritative recap id
//     played_at: ISO8601 string,
//     store_id?: string,
//     play_context: { ... },             // see saga/docs/recap-as-training-data.md
//     games: [
//       {
//         game_id: number,               // BGG ID
//         group_player_ids: string[],    // passport IDs of players at the table
//         duration_min?: number,
//         did_game_finish: boolean,
//         winner_player_id?: string,
//         winner_score?: number,
//         loser_scores?: { [playerId]: number },
//         score_decisive?: boolean,
//         notable_events: { kingmaker_event?: bool, runaway_leader?: bool, ... },
//         per_player: [
//           {
//             player_id: string,
//             player_role_outcome: string,    // 'won' | 'second' | 'mid' | 'last' | 'eliminated_at_turn_N'
//             fun_rating: number,             // 1..5 — the headline label
//             would_play_again?: string,
//             engagement_during_play?: number,
//             regrets?: string,
//             memorable_for_player?: boolean,
//           }
//         ]
//       }
//     ]
//   }
//
// Returns: { observationsWritten, perPlayerRowsWritten, alreadyPresent }
// ============================================================================

/**
 * @param {object} pgClient - pg.Client already connected. Caller manages
 *   lifecycle (we don't open or close).
 * @param {object} recapPayload - shape per the doc above.
 * @returns {Promise<{ observationsWritten: number, perPlayerRowsWritten: number, alreadyPresent: boolean }>}
 */
export async function ingestRecap(pgClient, recapPayload) {
  if (!recapPayload || typeof recapPayload !== 'object') {
    throw new Error('ingestRecap: recapPayload required');
  }
  const { recap_id, played_at, store_id, play_context, games } = recapPayload;
  if (typeof recap_id !== 'string' || !recap_id) {
    throw new Error('ingestRecap: recap_id required');
  }
  if (typeof played_at !== 'string') {
    throw new Error('ingestRecap: played_at required (ISO 8601)');
  }
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error('ingestRecap: games[] required + non-empty');
  }

  let observationsWritten = 0;
  let perPlayerRowsWritten = 0;
  let alreadyPresent = false;

  await pgClient.query('BEGIN');
  try {
    for (const g of games) {
      if (typeof g.game_id !== 'number') {
        throw new Error(`ingestRecap: each game requires numeric game_id (got ${typeof g.game_id})`);
      }
      if (!Array.isArray(g.group_player_ids) || g.group_player_ids.length === 0) {
        throw new Error(`ingestRecap: game_id=${g.game_id} requires group_player_ids[] non-empty`);
      }
      if (!Array.isArray(g.per_player) || g.per_player.length === 0) {
        throw new Error(`ingestRecap: game_id=${g.game_id} requires per_player[] non-empty`);
      }

      const insertObservation = await pgClient.query(
        `INSERT INTO rec_saga_recap_observation (
          recap_id, played_at, game_id, group_size, group_player_ids,
          duration_min, did_game_finish, winner_player_id, winner_score,
          loser_scores, score_decisive, notable_events, play_context, store_id
        ) VALUES (
          $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9,
          $10::jsonb, $11, $12::jsonb, $13::jsonb, $14
        )
        ON CONFLICT (recap_id, game_id) DO NOTHING
        RETURNING id`,
        [
          recap_id,
          played_at,
          g.game_id,
          g.group_player_ids.length,
          JSON.stringify(g.group_player_ids),
          g.duration_min ?? null,
          g.did_game_finish ?? true,
          g.winner_player_id ?? null,
          g.winner_score ?? null,
          g.loser_scores ? JSON.stringify(g.loser_scores) : null,
          g.score_decisive ?? null,
          JSON.stringify(g.notable_events ?? {}),
          JSON.stringify(play_context ?? {}),
          store_id ?? null,
        ],
      );

      let observationId;
      if (insertObservation.rowCount > 0) {
        observationId = insertObservation.rows[0].id;
        observationsWritten++;
      } else {
        // Already present — fetch its id to skip per-player insert below
        // (re-ingest is a no-op; we don't double-insert per-player rows).
        alreadyPresent = true;
        const existing = await pgClient.query(
          'SELECT id FROM rec_saga_recap_observation WHERE recap_id = $1 AND game_id = $2',
          [recap_id, g.game_id],
        );
        observationId = existing.rows[0]?.id;
        if (!observationId) {
          // Shouldn't happen — conflict but no row? Treat as data race.
          throw new Error(`ingestRecap: could not resolve observation id for recap_id=${recap_id} game_id=${g.game_id}`);
        }
        // Skip per-player inserts when the observation was already there
        // (we'd hit the per-player unique constraint anyway). Continue
        // to next game.
        continue;
      }

      for (const p of g.per_player) {
        if (typeof p.player_id !== 'string' || !p.player_id) {
          throw new Error(`ingestRecap: per_player entries require player_id`);
        }
        if (typeof p.fun_rating !== 'number' || p.fun_rating < 1 || p.fun_rating > 5) {
          throw new Error(`ingestRecap: per_player.fun_rating must be 1..5 (got ${p.fun_rating} for ${p.player_id})`);
        }
        const perPlayerInsert = await pgClient.query(
          `INSERT INTO rec_saga_per_player_observation (
            recap_observation_id, player_id, player_role_outcome,
            fun_rating, would_play_again, engagement_during_play,
            regrets, memorable_for_player
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (recap_observation_id, player_id) DO NOTHING`,
          [
            observationId,
            p.player_id,
            p.player_role_outcome ?? null,
            p.fun_rating,
            p.would_play_again ?? null,
            p.engagement_during_play ?? null,
            p.regrets ?? null,
            !!p.memorable_for_player,
          ],
        );
        perPlayerRowsWritten += perPlayerInsert.rowCount ?? 0;
      }
    }
    await pgClient.query('COMMIT');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  }

  return { observationsWritten, perPlayerRowsWritten, alreadyPresent };
}
