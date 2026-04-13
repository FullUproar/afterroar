'use client';

import { useState, useRef } from 'react';
import { Search, X, Plus, Package, Truck, Heart, ThumbsDown, Loader2 } from 'lucide-react';

interface GameEntry {
  title: string;
  slug?: string;
  own: boolean;
  bring: boolean;
  love: boolean;
  nope: boolean;
}

interface SearchResult {
  title: string;
  slug: string;
  minPlayers?: number;
  maxPlayers?: number;
  complexity?: number;
}

function FlagButton({ active, icon: Icon, label, color, onClick }: {
  active: boolean;
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: '0.3rem 0.5rem',
        background: active ? `${color}20` : 'transparent',
        border: `1px solid ${active ? color : '#374151'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
    >
      <Icon size={14} style={{ color: active ? color : '#6b7280' }} />
      <span style={{ fontSize: '0.7rem', color: active ? color : '#6b7280' }}>{label}</span>
    </button>
  );
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
    const updated = [...games, { title, slug, own: true, bring: false, love: false, nope: false }];
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

  const toggleFlag = (title: string, flag: keyof Pick<GameEntry, 'own' | 'bring' | 'love' | 'nope'>) => {
    const updated = games.map((g) =>
      g.title === title ? { ...g, [flag]: !g[flag] } : g
    );
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

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div style={{
            marginTop: '0.25rem',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            maxHeight: '250px',
            overflowY: 'auto',
          }}>
            {results.map((r) => (
              <button
                key={r.slug || r.title}
                onClick={() => addGame(r.title, r.slug)}
                disabled={games.some((g) => g.title.toLowerCase() === r.title.toLowerCase())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #374151',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                  cursor: games.some((g) => g.title.toLowerCase() === r.title.toLowerCase()) ? 'default' : 'pointer',
                  opacity: games.some((g) => g.title.toLowerCase() === r.title.toLowerCase()) ? 0.4 : 1,
                  textAlign: 'left',
                }}
              >
                <span>{r.title}</span>
                {r.minPlayers && r.maxPlayers && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {r.minPlayers}-{r.maxPlayers}p
                  </span>
                )}
              </button>
            ))}
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
            Search above to add games you own, love, or are willing to bring to game night.
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
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', minWidth: 0, flex: 1 }}>
                {game.title}
              </span>

              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <FlagButton active={game.own} icon={Package} label="Own" color="#FF8200" onClick={() => toggleFlag(game.title, 'own')} />
                <FlagButton active={game.bring} icon={Truck} label="Bring" color="#3b82f6" onClick={() => toggleFlag(game.title, 'bring')} />
                <FlagButton active={game.love} icon={Heart} label="Love" color="#ec4899" onClick={() => toggleFlag(game.title, 'love')} />
                <FlagButton active={game.nope} icon={ThumbsDown} label="Nope" color="#6b7280" onClick={() => toggleFlag(game.title, 'nope')} />
              </div>

              <button
                onClick={() => removeGame(game.title)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
              >
                <X size={14} style={{ color: '#4b5563' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
