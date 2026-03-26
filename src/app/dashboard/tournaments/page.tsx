'use client';

import { useState, useEffect, useCallback } from 'react';

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

const STATUS_COLORS: Record<string, string> = {
  registration: 'bg-blue-900 text-blue-300',
  active: 'bg-green-900 text-green-300',
  completed: 'bg-zinc-700 text-zinc-300',
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);

  // New tournament form
  const [formName, setFormName] = useState('');
  const [formFormat, setFormFormat] = useState('');
  const [formMaxPlayers, setFormMaxPlayers] = useState('');
  const [saving, setSaving] = useState(false);

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
          bracket_type: 'single_elimination',
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
    const res = await fetch(`/api/tournaments/${activeTournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTournament(data);
      loadTournaments();
    }
  }

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setActiveTournament(null)} className="text-sm text-zinc-400 hover:text-white mb-2 block">
              &larr; Back to tournaments
            </button>
            <h1 className="text-2xl font-bold text-white">{activeTournament.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {activeTournament.format && (
                <span className="text-sm text-zinc-400">Format: {activeTournament.format}</span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[activeTournament.status] || 'bg-zinc-700 text-zinc-300'}`}>
                {activeTournament.status}
              </span>
              {activeTournament.current_round > 0 && (
                <span className="text-sm text-zinc-400">
                  Round {activeTournament.current_round}/{activeTournament.total_rounds}
                </span>
              )}
            </div>
          </div>
          {activeTournament.status === 'registration' && players.length >= 2 && (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium"
            >
              Start Tournament ({players.length} players)
            </button>
          )}
        </div>

        {/* Registration phase: add players */}
        {activeTournament.status === 'registration' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Players ({players.length}{activeTournament.max_players ? `/${activeTournament.max_players}` : ''})</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                placeholder="Player name"
                className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              />
              <button
                onClick={handleAddPlayer}
                disabled={addingPlayer || !playerName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm"
              >
                Add Player
              </button>
            </div>
            {players.length > 0 && (
              <div className="space-y-1">
                {players.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between bg-zinc-800 rounded px-3 py-2 text-sm text-white">
                    <span>{i + 1}. {p.player_name}</span>
                    <button onClick={() => handleDropPlayer(p.id)} className="text-red-500 hover:text-red-400 text-xs">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active / Completed: Bracket */}
        {(activeTournament.status === 'active' || activeTournament.status === 'completed') && roundNumbers.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Bracket</h2>
            <div className="flex gap-8 overflow-x-auto pb-4">
              {roundNumbers.map((round) => (
                <div key={round} className="min-w-[220px]">
                  <h3 className="text-xs text-zinc-400 uppercase tracking-wide mb-3">
                    {round === (activeTournament.total_rounds || 1) ? 'Finals' : `Round ${round}`}
                  </h3>
                  <div className="space-y-4">
                    {rounds[round].map((match) => {
                      const isActive = match.status === 'pending' && match.player1_id && match.player2_id;
                      return (
                        <div
                          key={match.id}
                          className={`rounded border ${
                            match.status === 'completed'
                              ? 'border-zinc-700 bg-zinc-800'
                              : isActive
                              ? 'border-indigo-700 bg-zinc-800'
                              : 'border-zinc-800 bg-zinc-900'
                          }`}
                        >
                          {/* Player 1 */}
                          <div className={`px-3 py-2 text-sm flex items-center justify-between border-b border-zinc-700 ${
                            match.winner_id === match.player1_id ? 'text-green-400 font-medium' : 'text-white'
                          }`}>
                            <span>{match.player1_id ? getPlayerName(match.player1_id) : 'TBD'}</span>
                            {match.status === 'completed' && <span className="text-xs text-zinc-400">{match.player1_score}</span>}
                          </div>
                          {/* Player 2 */}
                          <div className={`px-3 py-2 text-sm flex items-center justify-between ${
                            match.winner_id === match.player2_id ? 'text-green-400 font-medium' : 'text-white'
                          }`}>
                            <span>{match.player2_id ? getPlayerName(match.player2_id) : 'TBD'}</span>
                            {match.status === 'completed' && <span className="text-xs text-zinc-400">{match.player2_score}</span>}
                          </div>
                          {/* Report button */}
                          {isActive && activeTournament.status === 'active' && (
                            <div className="border-t border-zinc-700 px-3 py-1.5">
                              <button
                                onClick={() => {
                                  setReportMatch(match);
                                  setReportWinnerId('');
                                  setReportP1Score('0');
                                  setReportP2Score('0');
                                }}
                                className="text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                Report Result
                              </button>
                              {match.table_number && (
                                <span className="text-xs text-zinc-500 ml-2">{match.table_number}</span>
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
        )}

        {/* Standings */}
        {(activeTournament.status === 'active' || activeTournament.status === 'completed') && standings.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-white mb-3">
              {activeTournament.status === 'completed' ? 'Final Standings' : 'Current Standings'}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 text-left">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Player</th>
                  <th className="pb-2 font-medium text-center">W</th>
                  <th className="pb-2 font-medium text-center">L</th>
                  <th className="pb-2 font-medium text-center">D</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p, i) => (
                  <tr key={p.id} className={`border-t border-zinc-800 ${
                    p.standing === 1 ? 'text-yellow-400' : 'text-white'
                  }`}>
                    <td className="py-2">{p.standing || i + 1}</td>
                    <td className="py-2 font-medium">
                      {p.player_name}
                      {p.standing === 1 && activeTournament.status === 'completed' && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-yellow-900 text-yellow-300">Champion</span>
                      )}
                    </td>
                    <td className="py-2 text-center text-green-400">{p.wins}</td>
                    <td className="py-2 text-center text-red-400">{p.losses}</td>
                    <td className="py-2 text-center text-zinc-400">{p.draws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Match Modal */}
        {reportMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setReportMatch(null)}>
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-white mb-4">Report Match Result</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Winner</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[reportMatch.player1_id, reportMatch.player2_id].filter(Boolean).map((pid) => (
                      <button
                        key={pid}
                        onClick={() => setReportWinnerId(pid!)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          reportWinnerId === pid
                            ? 'bg-green-700 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {getPlayerName(pid!)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">{getPlayerName(reportMatch.player1_id)} Score</label>
                    <input
                      type="number"
                      min={0}
                      value={reportP1Score}
                      onChange={(e) => setReportP1Score(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">{getPlayerName(reportMatch.player2_id)} Score</label>
                    <input
                      type="number"
                      min={0}
                      value={reportP2Score}
                      onChange={(e) => setReportP2Score(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setReportMatch(null)} className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleReportMatch}
                    disabled={reporting || !reportWinnerId}
                    className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded text-sm font-medium"
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Tournaments</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
        >
          {showForm ? 'Cancel' : 'New Tournament'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name *</label>
              <input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                placeholder="Friday Night Magic"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Format</label>
              <input
                value={formFormat}
                onChange={(e) => setFormFormat(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                placeholder="Standard, Modern, Draft..."
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Max Players</label>
              <input
                type="number"
                min={2}
                value={formMaxPlayers}
                onChange={(e) => setFormMaxPlayers(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                placeholder="No limit"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm font-medium">
              {saving ? 'Creating...' : 'Create Tournament'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading tournaments...</p>
      ) : tournaments.length === 0 ? (
        <p className="text-zinc-400">No tournaments yet. Create one to get started.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium text-center">Players</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openTournament(t.id)}
                  className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer text-white"
                >
                  <td className="px-4 py-3 font-medium">
                    {t.name}
                    {t.event && (
                      <span className="ml-2 text-xs text-zinc-500">({t.event.name})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{t.format || '--'}</td>
                  <td className="px-4 py-3 text-center text-zinc-300">
                    {t._count?.players || 0}
                    {t.max_players && <span className="text-zinc-500">/{t.max_players}</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${STATUS_COLORS[t.status] || 'bg-zinc-700 text-zinc-300'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
