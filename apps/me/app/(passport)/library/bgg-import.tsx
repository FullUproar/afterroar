'use client';

import { useState } from 'react';
import { Download, Check, X } from 'lucide-react';
import { Button, TYPE, SpinnerInline, inputStyle } from '@/app/components/ui';

interface BGGGame {
  title: string;
  bggId: number;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bggRating: number | null;
  alreadyOwned: boolean;
}

export function BGGImport({ existingGames, onImport }: {
  existingGames: string[];
  onImport: (games: Array<{ title: string; bggId: number }>) => void;
}) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BGGGame[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleFetch = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch('/api/library/import-bgg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();

      if (res.status === 202) {
        setError(data.error || 'BGG is preparing your collection. Try again in a few seconds.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Import failed');
        setLoading(false);
        return;
      }

      const newGames = (data.games as BGGGame[]).filter(
        (g) => !g.alreadyOwned && !existingGames.some((eg) => eg.toLowerCase() === g.title.toLowerCase())
      );
      setResults(newGames);
      setSelected(new Set(newGames.map((g) => g.title)));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGame = (title: string) => {
    const next = new Set(selected);
    if (next.has(title)) next.delete(title); else next.add(title);
    setSelected(next);
  };

  const confirmImport = () => {
    if (!results || selected.size === 0) return;
    const toImport = results.filter((g) => selected.has(g.title)).map((g) => ({ title: g.title, bggId: g.bggId }));
    onImport(toImport);
    setResults(null);
    setSelected(new Set());
    setUsername('');
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {!results ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Download size={14} style={{ position: 'absolute', top: '50%', left: '0.7rem', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
              placeholder="BGG username"
              style={inputStyle({ paddingLeft: '2rem' })}
            />
          </div>
          <Button size="sm" onClick={handleFetch} disabled={!username.trim() || loading}>
            {loading ? <><SpinnerInline size={12} /> Importing</> : 'Import'}
          </Button>
        </div>
      ) : (
        <div style={{ border: '2px solid var(--orange)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ ...TYPE.displayMd, margin: 0, color: 'var(--orange)', fontSize: '0.95rem' }}>
              {results.length > 0 ? `${results.length} new game${results.length !== 1 ? 's' : ''} from BGG` : 'No new games found'}
            </h3>
            <button onClick={() => { setResults(null); setSelected(new Set()); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)',
            }}><X size={16} /></button>
          </div>

          {results.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.9rem', maxHeight: '300px', overflowY: 'auto' }}>
                {results.map((game) => {
                  const on = selected.has(game.title);
                  return (
                    <button key={game.title} onClick={() => toggleGame(game.title)} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      textAlign: 'left',
                      width: '100%',
                      background: on ? 'var(--orange-weak)' : 'transparent',
                      border: `1px solid ${on ? 'var(--orange)' : 'var(--rule)'}`,
                      color: 'var(--cream)',
                      cursor: 'pointer',
                      ...TYPE.body,
                      fontSize: '0.85rem',
                    }}>
                      <div style={{
                        width: '16px', height: '16px', flexShrink: 0,
                        border: `2px solid ${on ? 'var(--orange)' : 'var(--ink-faint)'}`,
                        background: on ? 'var(--orange)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on ? <Check size={10} color="var(--void)" /> : null}
                      </div>
                      <span style={{ flex: 1 }}>{game.title}</span>
                      {game.yearPublished ? (
                        <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.68rem' }}>({game.yearPublished})</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <Button onClick={confirmImport} disabled={selected.size === 0}>
                Import {selected.size} game{selected.size !== 1 ? 's' : ''}
              </Button>
            </>
          ) : (
            <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.85rem', margin: 0 }}>
              All games from this BGG collection are already in your library.
            </p>
          )}
        </div>
      )}

      {error ? <p style={{ ...TYPE.body, color: 'var(--red)', fontSize: '0.78rem', margin: '0.5rem 0 0' }}>{error}</p> : null}
    </div>
  );
}
