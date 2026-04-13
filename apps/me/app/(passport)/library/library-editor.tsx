'use client';

import { useState, useRef } from 'react';
import { Search, X, Plus, Loader2 } from 'lucide-react';

/**
 * Passport Game Library Editor — ownership only.
 *
 * The Passport stores what you own. That's universally relevant data
 * that any connected app can read via /api/library.
 *
 * App-specific preferences (bring, love, nope for game nights) are
 * owned by the app that needs them — HQ stores those in its own DB.
 */

interface GameEntry {
  title: string;
  slug?: string;
}

interface SearchResult {
  title: string;
  slug: string;
  minPlayers?: number;
  maxPlayers?: number;
  complexity?: number;
}

export function LibraryEditor({ initialGames }: { initialGames: GameEntry[] }) {
  const [games, setGames] = useState<GameEntry[]>(initialGames);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [manualAdd, setManualAdd] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (query: string) => {
    setSearch(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setResults([]); return; }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/library/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {} finally {
        setSearching(false);
      }
    }, 300);
  };

  const addGame = (title: string, slug?: string) => {
    if (games.some((g) => g.title.toLowerCase() === title.toLowerCase())) return;
    const updated = [...games, { title, slug }];
    setGames(updated);
    setSearch('');
    setResults([]);
    setManualTitle('');
    setManualAdd(false);
    save(updated);
  };

  const removeGame = (title: string) => {
    const updated = games.filter((g) => g.title !== title);
    setGames(updated);
    save(updated);
  };

  const save = async (gameList: GameEntry[]) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/library/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ games: gameList }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          background: '#1f2937',
          borderRadius: '8px',
          padding: '0.5rem 0.75rem',
          border: '1px solid #374151',
        }}>
          <Search size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search games to add..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={16} style={{ color: '#6b7280' }} />
            </button>
          )}
          {searching && <Loader2 size={16} style={{ color: '#FF8200', animation: 'spin 1s linear infinite' }} />}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div style={{
            marginTop: '0.25rem',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            maxHeight: '250px',
            overflowY: 'auto',
          }}>
            {results.map((r) => {
              const alreadyAdded = games.some((g) => g.title.toLowerCase() === r.title.toLowerCase());
              return (
                <button
                  key={r.slug || r.title}
                  onClick={() => addGame(r.title, r.slug)}
                  disabled={alreadyAdded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #374151',
                    color: alreadyAdded ? '#6b7280' : '#e2e8f0',
                    fontSize: '0.9rem',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    opacity: alreadyAdded ? 0.4 : 1,
                    textAlign: 'left',
                  }}
                >
                  <span>{r.title}{alreadyAdded ? ' (added)' : ''}</span>
                  {r.minPlayers && r.maxPlayers && (
                    <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                      {r.minPlayers}–{r.maxPlayers}p
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Manual add */}
        <div style={{ marginTop: '0.5rem' }}>
          {!manualAdd ? (
            <button
              onClick={() => setManualAdd(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Plus size={14} /> Add a game not in the database
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Game title"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && manualTitle.trim()) addGame(manualTitle.trim()); }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  background: '#0a0a0a',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => { if (manualTitle.trim()) addGame(manualTitle.trim()); }}
                disabled={!manualTitle.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: manualTitle.trim() ? '#FF8200' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  color: manualTitle.trim() ? '#0a0a0a' : '#6b7280',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: manualTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setManualAdd(false); setManualTitle(''); }}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save status */}
      {(saving || saved) && (
        <p style={{ color: saved ? '#10b981' : '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          {saving ? 'Saving...' : 'Saved'}
        </p>
      )}

      {/* Game list */}
      {games.length === 0 ? (
        <div style={{
          padding: '3rem',
          background: '#1f2937',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>
            Your library is empty
          </p>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
            Search above to add games you own.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {games.map((game) => (
            <div key={game.title} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: '#1f2937',
              borderRadius: '8px',
            }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                {game.title}
              </span>
              <button
                onClick={() => removeGame(game.title)}
                title="Remove from library"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#4b5563',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: '0.5rem 0 0', textAlign: 'center' }}>
            {games.length} {games.length === 1 ? 'game' : 'games'} in your library
          </p>
        </div>
      )}
    </div>
  );
}
