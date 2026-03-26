import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("events.manage");
    const { id } = await params;

    const tournament = await db.posTournament.findFirst({
      where: { id },
      include: {
        event: { select: { id: true, name: true } },
        players: { orderBy: { standing: "asc" } },
        matches: {
          orderBy: [{ round_number: "asc" }, { match_number: "asc" }],
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(tournament);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("events.manage");
    const { id } = await params;
    const body = await request.json();
    const { name, format, max_players } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { updated_at: new Date() };
    if (name) updateData.name = name.trim();
    if (format !== undefined) updateData.format = format;
    if (max_players !== undefined)
      updateData.max_players = max_players ? parseInt(max_players) : null;

    const updated = await db.posTournament.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("events.manage");
    const { id } = await params;
    const body = await request.json();

    const tournament = await db.posTournament.findFirst({
      where: { id },
      include: {
        players: true,
        matches: true,
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // --- ADD PLAYER ---
    if (body.action === "add_player") {
      if (tournament.status !== "registration") {
        return NextResponse.json(
          { error: "Can only add players during registration" },
          { status: 400 }
        );
      }

      const { player_name, customer_id } = body;
      if (!player_name || typeof player_name !== "string") {
        return NextResponse.json(
          { error: "Player name is required" },
          { status: 400 }
        );
      }

      if (
        tournament.max_players &&
        tournament.players.length >= tournament.max_players
      ) {
        return NextResponse.json(
          { error: "Tournament is full" },
          { status: 400 }
        );
      }

      const player = await db.posTournamentPlayer.create({
        data: {
          tournament_id: id,
          player_name: player_name.trim(),
          customer_id: customer_id || null,
          seed: tournament.players.length + 1,
        },
      });

      return NextResponse.json(player, { status: 201 });
    }

    // --- START TOURNAMENT ---
    if (body.action === "start") {
      if (tournament.status !== "registration") {
        return NextResponse.json(
          { error: "Tournament already started" },
          { status: 400 }
        );
      }

      const activePlayers = tournament.players.filter((p) => !p.dropped);
      if (activePlayers.length < 2) {
        return NextResponse.json(
          { error: "Need at least 2 players" },
          { status: 400 }
        );
      }

      // Shuffle players
      const shuffled = [...activePlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Calculate rounds for single elimination
      const totalRounds = Math.ceil(Math.log2(shuffled.length));
      const bracketSize = Math.pow(2, totalRounds);

      // Create round 1 matches with byes
      const matches = [];
      const matchCount = bracketSize / 2;

      for (let m = 0; m < matchCount; m++) {
        const p1 = shuffled[m] || null;
        const p2 = shuffled[bracketSize - 1 - m] || null;

        const isBye = !p1 || !p2;

        matches.push({
          tournament_id: id,
          round_number: 1,
          match_number: m + 1,
          player1_id: p1?.id || null,
          player2_id: p2?.id || null,
          winner_id: isBye ? (p1?.id || p2?.id || null) : null,
          status: isBye ? "completed" : "pending",
          table_number: `Table ${m + 1}`,
        });
      }

      // Create future round matches (empty)
      for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = Math.pow(2, totalRounds - round);
        for (let m = 0; m < roundMatches; m++) {
          matches.push({
            tournament_id: id,
            round_number: round,
            match_number: m + 1,
            player1_id: null,
            player2_id: null,
            winner_id: null,
            status: "pending",
            table_number: null,
          });
        }
      }

      // Bulk create matches
      await db.posTournamentMatch.createMany({ data: matches });

      // Update tournament
      await db.posTournament.update({
        where: { id },
        data: {
          status: "active",
          current_round: 1,
          total_rounds: totalRounds,
          updated_at: new Date(),
        },
      });

      // After creating matches, advance byes for round 1
      const createdMatches = await db.posTournamentMatch.findMany({
        where: { tournament_id: id, round_number: 1, status: "completed" },
      });

      for (const byeMatch of createdMatches) {
        if (byeMatch.winner_id) {
          await advanceWinner(db, id, 1, byeMatch.match_number, byeMatch.winner_id, totalRounds);
          // Give bye player a win
          await db.posTournamentPlayer.update({
            where: { id: byeMatch.winner_id },
            data: { wins: { increment: 1 } },
          });
        }
      }

      const result = await db.posTournament.findFirst({
        where: { id },
        include: {
          players: true,
          matches: {
            orderBy: [{ round_number: "asc" }, { match_number: "asc" }],
          },
        },
      });

      return NextResponse.json(result);
    }

    // --- REPORT MATCH ---
    if (body.action === "report_match") {
      const { match_id, winner_id, player1_score, player2_score } = body;

      if (!match_id || !winner_id) {
        return NextResponse.json(
          { error: "match_id and winner_id are required" },
          { status: 400 }
        );
      }

      const match = tournament.matches.find((m) => m.id === match_id);
      if (!match) {
        return NextResponse.json(
          { error: "Match not found" },
          { status: 404 }
        );
      }

      if (match.status === "completed") {
        return NextResponse.json(
          { error: "Match already completed" },
          { status: 400 }
        );
      }

      if (winner_id !== match.player1_id && winner_id !== match.player2_id) {
        return NextResponse.json(
          { error: "Winner must be one of the match players" },
          { status: 400 }
        );
      }

      const loserId =
        winner_id === match.player1_id ? match.player2_id : match.player1_id;

      // Update match
      await db.posTournamentMatch.update({
        where: { id: match_id },
        data: {
          winner_id,
          player1_score: player1_score ?? 0,
          player2_score: player2_score ?? 0,
          status: "completed",
        },
      });

      // Update player records
      await db.posTournamentPlayer.update({
        where: { id: winner_id },
        data: { wins: { increment: 1 } },
      });

      if (loserId) {
        await db.posTournamentPlayer.update({
          where: { id: loserId },
          data: { losses: { increment: 1 } },
        });
      }

      // Advance winner to next round
      const totalRounds = tournament.total_rounds || 1;
      await advanceWinner(
        db,
        id,
        match.round_number,
        match.match_number,
        winner_id,
        totalRounds
      );

      // Check if tournament is complete (final match decided)
      if (match.round_number === totalRounds) {
        await db.posTournament.update({
          where: { id },
          data: { status: "completed", updated_at: new Date() },
        });

        // Set standings
        await db.posTournamentPlayer.update({
          where: { id: winner_id },
          data: { standing: 1 },
        });
        if (loserId) {
          await db.posTournamentPlayer.update({
            where: { id: loserId },
            data: { standing: 2 },
          });
        }
      }

      const result = await db.posTournament.findFirst({
        where: { id },
        include: {
          players: true,
          matches: {
            orderBy: [{ round_number: "asc" }, { match_number: "asc" }],
          },
        },
      });

      return NextResponse.json(result);
    }

    // --- DROP PLAYER ---
    if (body.action === "drop_player") {
      const { player_id } = body;
      if (!player_id) {
        return NextResponse.json(
          { error: "player_id required" },
          { status: 400 }
        );
      }

      await db.posTournamentPlayer.update({
        where: { id: player_id },
        data: { dropped: true },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleAuthError(error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advanceWinner(
  db: any,
  tournamentId: string,
  currentRound: number,
  currentMatchNumber: number,
  winnerId: string,
  totalRounds: number
) {
  if (currentRound >= totalRounds) return;

  const nextRound = currentRound + 1;
  const nextMatchNumber = Math.ceil(currentMatchNumber / 2);

  // Find next round match
  const nextMatch = await db.posTournamentMatch.findFirst({
    where: {
      tournament_id: tournamentId,
      round_number: nextRound,
      match_number: nextMatchNumber,
    },
  });

  if (!nextMatch) return;

  // Determine if winner goes to player1 or player2 slot
  const isOddMatch = currentMatchNumber % 2 === 1;
  const updateData = isOddMatch
    ? { player1_id: winnerId }
    : { player2_id: winnerId };

  await db.posTournamentMatch.update({
    where: { id: nextMatch.id },
    data: updateData,
  });
}
