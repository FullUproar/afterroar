'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { SubNav } from '@/components/ui/sub-nav';
import { EVENTS_TABS } from '@/lib/nav-groups';

interface Tournament {
  id: string;
  store_id: string;
  event_id: string | null;
  name: string;
  format: string | null;
  status: string;
  bracket_type: string;
  max_players: number | null;
  current_round: number;
  total_rounds: number | null;
  created_at: string;
  event?: { id: string; name: string } | null;
  _count?: { players: number; matches: number };
  players?: TournamentPlayer[];
  matches?: TournamentMatch[];
}

interface TournamentPlayer {
  id: string;
  tournament_id: string;
  customer_id: string | null;
  player_name: string;
  seed: number | null;
  wins: number;
  losses: number;
  draws: number;
  dropped: boolean;
  standing: number | null;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
  status: string;
  table_number: string | null;
}

/* ---------- shared styles ---------- */
const inputStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--rule-hi)',
  color: 'var(--ink)',
  fontSize: '0.92rem',
  padding: '0.65rem 0.85rem',
  minHeight: 44,
  outline: 'none',
  width: '100%',
};

const ghostBtnStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  letterSpacing: '0.18em',
  fontWeight: 600,
  padding: '0 0.85rem',
  minHeight: 44,
  color: 'var(--ink-soft)',
  border: '1px solid var(--rule-hi)',
  background: 'var(--panel)',
};

const primaryBtnStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  letterSpacing: '0.06em',
  fontWeight: 700,
  padding: '0 1rem',
  minHeight: 48,
  color: 'var(--void)',
  background: 'var(--orange)',
  border: '1px solid var(--orange)',
};

const tealBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--teal)',
  border: '1px solid var(--teal)',
};

function tournamentStatusStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 700,
    padding: '2px 6px',
  };
  if (status === 'registration') return { ...base, color: 'var(--orange)', background: 'var(--orange-mute)', border: '1px solid var(--orange)' };
  if (status === 'active') return { ...base, color: 'var(--teal)', background: 'var(--teal-mute)', border: '1px solid var(--teal)' };
  if (status === 'completed') return { ...base, color: 'var(--ink-soft)', background: 'var(--panel)', border: '1px solid var(--rule-hi)' };
  return { ...base, color: 'var(--ink-soft)', background: 'var(--panel)', border: '1px solid var(--rule-hi)' };
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);

  // New tournament form
  const [formName, setFormName] = useState('');
  const [formFormat, setFormFormat] = useState('');
  const [formMaxPlayers, setFormMaxPlayers] = useState('');
  const [formBracketType, setFormBracketType] = useState<'swiss' | 'single_elimination'>('swiss');
  const [saving, setSaving] = useState(false);

  // Round timer
  const [roundStartTime, setRoundStartTime] = useState<Date | null>(null);
  const [roundMinutes, setRoundMinutes] = useState(50);
  const [timerDisplay, setTimerDisplay] = useState('');

  // Add player
  const [playerName, setPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Report match
  const [reportMatch, setReportMatch] = useState<TournamentMatch | null>(null);
  const [reportWinnerId, setReportWinnerId] = useState('');
  const [reportP1Score, setReportP1Score] = useState('0');
  const [reportP2Score, setReportP2Score] = useState('0');
  const [reporting, setReporting] = useState(false);

  const loadTournaments = useCallback(async () => {
    try {
      const res = await fetch('/api/tournaments');
      if (res.ok) setTournaments(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  async function openTournament(id: string) {
    const res = await fetch(`/api/tournaments/${id}`);
    if (res.ok) setActiveTournament(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          format: formFormat || null,
          bracket_type: formBracketType,
          max_players: formMaxPlayers || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowForm(false);
        setFormName('');
        setFormFormat('');
        setFormMaxPlayers('');
        loadTournaments();
        openTournament(data.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPlayer() {
    if (!activeTournament || !playerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/tournaments/${activeTournament.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_player', player_name: playerName.trim() }),
      });
      if (res.ok) {
        setPlayerName('');
        openTournament(activeTournament.id);
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleStart() {
    if (!activeTournament) return;
    const action = activeTournament.bracket_type === "swiss" ? "start_swiss" : "start";
    const res = await fetch(`/api/tournaments/${activeTournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTournament(data);
      setRoundStartTime(new Date());
      loadTournaments();
    }
  }

  async function handleNextRound() {
    if (!activeTournament) return;
    const res = await fetch(`/api/tournaments/${activeTournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'next_round' }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTournament(data);
      setRoundStartTime(new Date());
    }
  }

  // Round timer effect
  useEffect(() => {
    if (!roundStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartTime.getTime()) / 1000);
      const remaining = roundMinutes * 60 - elapsed;
      if (remaining <= 0) {
        setTimerDisplay("TIME!");
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        setTimerDisplay(`${m}:${String(s).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [roundStartTime, roundMinutes]);

  async function handleReportMatch() {
    if (!activeTournament || !reportMatch || !reportWinnerId) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/tournaments/${activeTournament.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report_match',
          match_id: reportMatch.id,
          winner_id: reportWinnerId,
          player1_score: parseInt(reportP1Score) || 0,
          player2_score: parseInt(reportP2Score) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTournament(data);
        setReportMatch(null);
        setReportWinnerId('');
        setReportP1Score('0');
        setReportP2Score('0');
        loadTournaments();
      }
    } finally {
      setReporting(false);
    }
  }

  async function handleDropPlayer(playerId: string) {
    if (!activeTournament) return;
    await fetch(`/api/tournaments/${activeTournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'drop_player', player_id: playerId }),
    });
    openTournament(activeTournament.id);
  }

  function getPlayerName(playerId: string | null): string {
    if (!playerId || !activeTournament?.players) return 'BYE';
    return activeTournament.players.find((p) => p.id === playerId)?.player_name || 'Unknown';
  }

  // Active tournament detail view
  if (activeTournament) {
    const players = activeTournament.players || [];
    const matches = activeTournament.matches || [];
    const rounds: Record<number, TournamentMatch[]> = {};
    matches.forEach((m) => {
      if (!rounds[m.round_number]) rounds[m.round_number] = [];
      rounds[m.round_number].push(m);
    });
    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    // Standings: sort by wins desc, losses asc
    const standings = [...players]
      .filter((p) => !p.dropped)
      .sort((a, b) => {
        if (a.standing && b.standing) return a.standing - b.standing;
        if (a.standing) return -1;
        if (b.standing) return 1;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <PageHeader
              title={activeTournament.name}
              crumb="Console · Floor"
              backHref="/dashboard/tournaments"
            />
            <div className="flex items-center gap-3 -mt-2 flex-wrap">
              {activeTournament.format && (
                <span className="font-mono text-ink-soft" style={{ fontSize: '0.78rem' }}>Format: {activeTournament.format}</span>
              )}
              <span style={tournamentStatusStyle(activeTournament.status)}>
                {activeTournament.status}
              </span>
              {activeTournament.current_round > 0 && (
                <span className="font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.78rem' }}>
                  Round {activeTournament.current_round}/{activeTournament.total_rounds}
                </span>
              )}
            </div>
          </div>
          {activeTournament.status === 'registration' && players.length >= 2 && (
            <button
              onClick={handleStart}
              className="inline-flex items-center font-display uppercase transition-colors"
              style={tealBtnStyle}
            >
              Start Tournament ({players.length} players)
            </button>
          )}
        </div>

        {/* Registration phase: add players */}
        {activeTournament.status === 'registration' && (
          <div className="ar-zone">
            <div className="ar-zone-head">
              <span>Players ({players.length}{activeTournament.max_players ? `/${activeTournament.max_players}` : ''})</span>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                  placeholder="Player name"
                  className="max-w-xs"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleAddPlayer}
                  disabled={addingPlayer || !playerName.trim()}
                  className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                  style={primaryBtnStyle}
                >
                  Add Player
                </button>
              </div>
              {players.length > 0 && (
                <div className="space-y-1">
                  {players.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 text-sm text-ink"
                      style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
                    >
                      <span><span className="font-mono text-ink-faint">{i + 1}.</span> {p.player_name}</span>
                      <button
                        onClick={() => handleDropPlayer(p.id)}
                        className="font-mono uppercase text-red-fu hover:underline"
                        style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active / Completed: Bracket */}
        {(activeTournament.status === 'active' || activeTournament.status === 'completed') && roundNumbers.length > 0 && (
          <div className="ar-zone">
            <div className="ar-zone-head"><span>Bracket</span></div>
            <div className="p-5">
              <div className="flex gap-8 overflow-x-auto pb-4 scroll-visible">
                {roundNumbers.map((round) => (
                  <div key={round} style={{ minWidth: 220 }}>
                    <h3 className="font-mono uppercase text-ink-faint mb-3" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                      {round === (activeTournament.total_rounds || 1) ? 'Finals' : `Round ${round}`}
                    </h3>
                    <div className="space-y-4">
                      {rounds[round].map((match) => {
                        const isActive = match.status === 'pending' && match.player1_id && match.player2_id;
                        return (
                          <div
                            key={match.id}
                            style={{
                              background: match.status === 'completed' ? 'var(--panel)' : isActive ? 'var(--orange-mute)' : 'var(--panel-mute)',
                              border: `1px solid ${match.status === 'completed' ? 'var(--rule-hi)' : isActive ? 'var(--orange)' : 'var(--rule)'}`,
                            }}
                          >
                            {/* Player 1 */}
                            <div
                              className="px-3 py-2 text-sm flex items-center justify-between"
                              style={{
                                color: match.winner_id === match.player1_id ? 'var(--teal)' : 'var(--ink)',
                                fontWeight: match.winner_id === match.player1_id ? 600 : 400,
                                borderBottom: '1px solid var(--rule)',
                              }}
                            >
                              <span>{match.player1_id ? getPlayerName(match.player1_id) : 'TBD'}</span>
                              {match.status === 'completed' && <span className="font-mono tabular-nums text-ink-soft text-xs">{match.player1_score}</span>}
                            </div>
                            {/* Player 2 */}
                            <div
                              className="px-3 py-2 text-sm flex items-center justify-between"
                              style={{
                                color: match.winner_id === match.player2_id ? 'var(--teal)' : 'var(--ink)',
                                fontWeight: match.winner_id === match.player2_id ? 600 : 400,
                              }}
                            >
                              <span>{match.player2_id ? getPlayerName(match.player2_id) : 'TBD'}</span>
                              {match.status === 'completed' && <span className="font-mono tabular-nums text-ink-soft text-xs">{match.player2_score}</span>}
                            </div>
                            {/* Report button */}
                            {isActive && activeTournament.status === 'active' && (
                              <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--rule)' }}>
                                <button
                                  onClick={() => {
                                    setReportMatch(match);
                                    setReportWinnerId('');
                                    setReportP1Score('0');
                                    setReportP2Score('0');
                                  }}
                                  className="font-mono uppercase text-orange hover:underline"
                                  style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}
                                >
                                  Report Result
                                </button>
                                {match.table_number && (
                                  <span className="font-mono text-ink-faint ml-2" style={{ fontSize: '0.62rem' }}>{match.table_number}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Round Timer + Next Round (Swiss) */}
        {activeTournament.status === "active" && activeTournament.bracket_type === "swiss" && (
          <div className="ar-zone">
            <div className="ar-zone-head"><span>Round Control</span></div>
            <div className="p-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div
                    className={`font-mono tabular-nums ${timerDisplay === "TIME!" ? "animate-pulse" : ""}`}
                    style={{
                      fontSize: '2rem',
                      fontWeight: 700,
                      color: timerDisplay === "TIME!" ? 'var(--red)' : 'var(--ink)',
                    }}
                  >
                    {timerDisplay || "--:--"}
                  </div>
                  <div className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                    Round Timer
                  </div>
                </div>
                {!roundStartTime && (
                  <button
                    onClick={() => setRoundStartTime(new Date())}
                    className="inline-flex items-center font-mono uppercase transition-colors"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      padding: '0 0.85rem',
                      minHeight: 44,
                      color: 'var(--void)',
                      background: 'var(--orange)',
                      border: '1px solid var(--orange)',
                    }}
                  >
                    Start Timer
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={roundMinutes}
                    onChange={(e) => setRoundMinutes(parseInt(e.target.value) || 50)}
                    className="w-14 font-mono tabular-nums text-center"
                    style={{ ...inputStyle, padding: '0.4rem 0.5rem' }}
                  />
                  <span className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}>min</span>
                </div>
              </div>
              <div className="flex gap-2">
                {(() => {
                  const currentRoundMatches = rounds[activeTournament.current_round] || [];
                  const allComplete = currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.status === "completed");
                  return allComplete ? (
                    <button
                      onClick={handleNextRound}
                      className="inline-flex items-center font-display uppercase transition-colors"
                      style={tealBtnStyle}
                    >
                      {activeTournament.current_round >= (activeTournament.total_rounds || 99) ? "Finalize Tournament" : `Start Round ${activeTournament.current_round + 1}`}
                    </button>
                  ) : (
                    <span className="font-mono uppercase text-ink-faint px-3 py-2" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      {currentRoundMatches.filter((m) => m.status !== "completed").length} match{currentRoundMatches.filter((m) => m.status !== "completed").length !== 1 ? "es" : ""} pending
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Standings */}
        {(activeTournament.status === 'active' || activeTournament.status === 'completed') && standings.length > 0 && (
          <div className="ar-zone">
            <div className="ar-zone-head">
              <span>{activeTournament.status === 'completed' ? 'Final Standings' : 'Current Standings'}</span>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono uppercase text-ink-faint text-left" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                    <th className="pb-2">#</th>
                    <th className="pb-2">Player</th>
                    <th className="pb-2 text-center">W</th>
                    <th className="pb-2 text-center">L</th>
                    <th className="pb-2 text-center">D</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{
                        borderTop: '1px solid var(--rule)',
                        color: p.standing === 1 ? 'var(--yellow)' : 'var(--ink)',
                      }}
                    >
                      <td className="py-2 font-mono tabular-nums">{p.standing || i + 1}</td>
                      <td className="py-2 font-display" style={{ fontWeight: 500 }}>
                        {p.player_name}
                        {p.standing === 1 && activeTournament.status === 'completed' && (
                          <span
                            className="ml-2 font-mono uppercase"
                            style={{
                              fontSize: '0.6rem',
                              letterSpacing: '0.18em',
                              fontWeight: 700,
                              padding: '2px 6px',
                              background: 'var(--yellow-mute)',
                              color: 'var(--yellow)',
                              border: '1px solid var(--yellow)',
                            }}
                          >
                            Champion
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-center font-mono tabular-nums text-teal">{p.wins}</td>
                      <td className="py-2 text-center font-mono tabular-nums text-red-fu">{p.losses}</td>
                      <td className="py-2 text-center font-mono tabular-nums text-ink-soft">{p.draws}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Match Modal */}
        {reportMatch && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-bg outline-none"
            onClick={() => setReportMatch(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setReportMatch(null); }}
            tabIndex={-1}
            ref={(el) => el?.focus()}
          >
            <div
              className="w-full max-w-sm shadow-2xl mx-4"
              style={{ background: 'var(--slate)', border: '1px solid var(--rule)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ar-zone-head">
                <span>Report Match Result</span>
                <button
                  onClick={() => setReportMatch(null)}
                  className="text-ink-soft hover:text-ink transition-colors text-lg"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                    Winner
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[reportMatch.player1_id, reportMatch.player2_id].filter(Boolean).map((pid) => {
                      const isWinner = reportWinnerId === pid;
                      return (
                        <button
                          key={pid}
                          onClick={() => setReportWinnerId(pid!)}
                          className="inline-flex items-center justify-center font-display uppercase transition-colors"
                          style={{
                            fontSize: '0.85rem',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                            padding: '0.65rem 0.85rem',
                            minHeight: 44,
                            color: isWinner ? 'var(--void)' : 'var(--ink-soft)',
                            background: isWinner ? 'var(--teal)' : 'var(--panel)',
                            border: `1px solid ${isWinner ? 'var(--teal)' : 'var(--rule-hi)'}`,
                          }}
                        >
                          {getPlayerName(pid!)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      {getPlayerName(reportMatch.player1_id)} Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={reportP1Score}
                      onChange={(e) => setReportP1Score(e.target.value)}
                      className="font-mono tabular-nums"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      {getPlayerName(reportMatch.player2_id)} Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={reportP2Score}
                      onChange={(e) => setReportP2Score(e.target.value)}
                      className="font-mono tabular-nums"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReportMatch(null)}
                    className="flex-1 inline-flex items-center justify-center font-mono uppercase transition-colors"
                    style={ghostBtnStyle}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportMatch}
                    disabled={reporting || !reportWinnerId}
                    className="flex-1 inline-flex items-center justify-center font-display uppercase transition-colors disabled:opacity-50"
                    style={tealBtnStyle}
                  >
                    {reporting ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tournament list view
  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={EVENTS_TABS} />
      <PageHeader
        title="Tournaments"
        crumb="Console · Floor"
        desc="Brackets, pairings, standings — Swiss and single-elim with a built-in round timer."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center font-display uppercase transition-colors"
            style={primaryBtnStyle}
          >
            {showForm ? 'Cancel' : 'New Tournament'}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="ar-zone">
          <div className="ar-zone-head"><span>New Tournament</span></div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Name *
                </label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={inputStyle}
                  placeholder="Friday Night Magic"
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Format
                </label>
                <input
                  value={formFormat}
                  onChange={(e) => setFormFormat(e.target.value)}
                  style={inputStyle}
                  placeholder="Standard, Modern, Draft..."
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Max Players
                </label>
                <input
                  type="number"
                  min={2}
                  value={formMaxPlayers}
                  onChange={(e) => setFormMaxPlayers(e.target.value)}
                  className="font-mono tabular-nums"
                  style={inputStyle}
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Bracket Type
                </label>
                <div className="flex" style={{ border: '1px solid var(--rule-hi)' }}>
                  <button
                    type="button"
                    onClick={() => setFormBracketType("swiss")}
                    className="flex-1 font-mono uppercase transition-colors"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      padding: '0.55rem 0.5rem',
                      minHeight: 44,
                      color: formBracketType === "swiss" ? 'var(--orange)' : 'var(--ink-soft)',
                      background: formBracketType === "swiss" ? 'var(--orange-mute)' : 'var(--panel)',
                    }}
                  >
                    Swiss
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBracketType("single_elimination")}
                    className="flex-1 font-mono uppercase transition-colors"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      padding: '0.55rem 0.5rem',
                      minHeight: 44,
                      color: formBracketType === "single_elimination" ? 'var(--orange)' : 'var(--ink-soft)',
                      background: formBracketType === "single_elimination" ? 'var(--orange-mute)' : 'var(--panel)',
                      borderLeft: '1px solid var(--rule-hi)',
                    }}
                  >
                    Single Elim
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={primaryBtnStyle}
              >
                {saving ? 'Creating...' : 'Create Tournament'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center font-mono uppercase transition-colors"
                style={ghostBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.06em' }}>Loading tournaments...</p>
      ) : tournaments.length === 0 ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Tournaments</span><span>No results</span></div>
          <div className="p-10 text-center">
            <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.66rem', letterSpacing: '0.28em' }}>
              No tournaments yet
            </p>
            <p className="font-display text-ink mb-4" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Create one to get started
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center font-display uppercase transition-colors"
              style={primaryBtnStyle}
            >
              New Tournament
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => openTournament(t.id)}
                className="ar-stripe ar-lstripe w-full p-3 text-left transition-colors hover:bg-panel"
                style={{
                  background: 'var(--panel-mute)',
                  border: '1px solid var(--rule)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-ink truncate" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t.name}</span>
                  <span style={tournamentStatusStyle(t.status)}>
                    {t.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                  <span>{t.format || 'No format'} · {t._count?.players || 0} players</span>
                  <span className="tabular-nums">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div
            className="hidden md:block overflow-hidden"
            style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
          >
            <table className="w-full text-sm">
              <thead style={{ borderBottom: '1px solid var(--rule)', background: 'var(--slate)' }}>
                <tr className="font-mono uppercase text-ink-soft text-left" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3 text-center">Players</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTournament(t.id)}
                    className="hover:bg-panel cursor-pointer text-ink"
                    style={{ borderTop: '1px solid var(--rule-faint)' }}
                  >
                    <td className="px-4 py-3 font-display" style={{ fontWeight: 500 }}>
                      {t.name}
                      {t.event && (
                        <span className="ml-2 font-mono text-ink-soft" style={{ fontSize: '0.7rem' }}>({t.event.name})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{t.format || '—'}</td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {t._count?.players || 0}
                      {t.max_players && <span className="text-ink-faint">/{t.max_players}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.78rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span style={tournamentStatusStyle(t.status)}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
