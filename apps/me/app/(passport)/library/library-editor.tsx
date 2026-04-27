'use client';

import { useState, useRef, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Button, Chip, EmptyState, TYPE, SpinnerInline, inputStyle } from '@/app/components/ui';

interface GameEntry {
  title: string;
  slug?: string;
  bggId?: number;
  /**
   * User-defined tags. Free text, case-preserved, compared case-insensitively
   * for dedupe + filtering. Power users with hundreds of games rely on these.
   *
   * NOTE: When user demand for richer per-game metadata emerges (custom fields
   * with typed values: enum, number, date), add a `customFields?: Record<string,
   * string | number | string[]>` here. The current JSON-blob storage on
   * User.gameLibrary already accommodates arbitrary keys — no schema change.
   */
  tags?: string[];
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayMinutes?: number | null;
  maxPlayMinutes?: number | null;
  complexity?: number | null;
}

function formatMeta(g: GameEntry): string | null {
  const parts: string[] = [];
  if (g.minPlayers != null && g.maxPlayers != null && g.minPlayers > 0 && g.maxPlayers > 0) {
    parts.push(g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`);
  }
  if (g.minPlayMinutes != null && g.maxPlayMinutes != null && g.minPlayMinutes > 0) {
    const t = g.minPlayMinutes === g.maxPlayMinutes ? `${g.minPlayMinutes} min` : `${g.minPlayMinutes}–${g.maxPlayMinutes} min`;
    parts.push(t);
  }
  if (g.complexity != null && g.complexity > 0) {
    parts.push(`weight ${g.complexity.toFixed(1)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface SearchResult {
  title: string;
  slug: string;
  minPlayers?: number;
  maxPlayers?: number;
  complexity?: number;
}

type TimeBand = 'quick' | 'medium' | 'long';
type WeightBand = 'light' | 'mid' | 'heavy';

export function LibraryEditor({ initialGames }: { initialGames: GameEntry[] }) {
  const [games, setGames] = useState<GameEntry[]>(initialGames);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [manualAdd, setManualAdd] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [playerFilter, setPlayerFilter] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeBand | null>(null);
  const [weightFilter, setWeightFilter] = useState<WeightBand | null>(null);
  /** Selected tag filters — lowercase for matching. AND semantics: a game
   *  must carry every selected tag to be shown. */
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  /** Game.title currently showing the inline tag-add input. */
  const [tagInputFor, setTagInputFor] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All distinct tags across the user's library, ordered by frequency.
  // Used for filter chips + inline-input autocomplete.
  const tagsByFrequency = useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>();
    for (const g of games) {
      for (const tag of g.tags || []) {
        const key = tag.toLowerCase();
        const slot = counts.get(key);
        if (slot) {
          slot.count++;
        } else {
          counts.set(key, { display: tag, count: 1 });
        }
      }
    }
    return Array.from(counts.entries())
      .map(([key, v]) => ({ key, display: v.display, count: v.count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [games]);

  const filtersActive =
    playerFilter != null || timeFilter != null || weightFilter != null || tagFilters.length > 0;

  const filtered = useMemo(() => {
    if (!filtersActive) return games;
    return games.filter((g) => {
      if (playerFilter != null) {
        if (g.minPlayers == null || g.maxPlayers == null || g.minPlayers === 0) return false;
        const fits = playerFilter === 6
          ? g.maxPlayers >= 6
          : g.minPlayers <= playerFilter && g.maxPlayers >= playerFilter;
        if (!fits) return false;
      }
      if (timeFilter != null) {
        const t = g.maxPlayMinutes ?? g.minPlayMinutes;
        if (t == null || t <= 0) return false;
        if (timeFilter === 'quick' && t >= 30) return false;
        if (timeFilter === 'medium' && (t < 30 || t > 90)) return false;
        if (timeFilter === 'long' && t <= 90) return false;
      }
      if (weightFilter != null) {
        if (g.complexity == null || g.complexity === 0) return false;
        if (weightFilter === 'light' && g.complexity >= 2.5) return false;
        if (weightFilter === 'mid' && (g.complexity < 2.5 || g.complexity > 3.5)) return false;
        if (weightFilter === 'heavy' && g.complexity <= 3.5) return false;
      }
      if (tagFilters.length > 0) {
        const gameTags = (g.tags || []).map((t) => t.toLowerCase());
        // AND semantics: every selected filter tag must be on the game
        if (!tagFilters.every((t) => gameTags.includes(t))) return false;
      }
      return true;
    });
  }, [games, playerFilter, timeFilter, weightFilter, tagFilters, filtersActive]);

  function clearFilters() {
    setPlayerFilter(null);
    setTimeFilter(null);
    setWeightFilter(null);
    setTagFilters([]);
  }

  function toggleTagFilter(tagKey: string) {
    setTagFilters((prev) => (prev.includes(tagKey) ? prev.filter((t) => t !== tagKey) : [...prev, tagKey]));
  }

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
      } catch {} finally { setSearching(false); }
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

  const addTag = (gameTitle: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const updated = games.map((g) => {
      if (g.title !== gameTitle) return g;
      const existing = g.tags || [];
      // Case-insensitive dedupe — preserve user's original casing on display.
      if (existing.some((t) => t.toLowerCase() === lower)) return g;
      return { ...g, tags: [...existing, trimmed] };
    });
    setGames(updated);
    save(updated);
    // Best-effort register in the shared tag namespace (autocomplete / discovery).
    fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => {});
  };

  function commitTagInput() {
    if (!tagInputFor) return;
    const value = tagInputValue.trim();
    if (value) addTag(tagInputFor, value);
    setTagInputFor(null);
    setTagInputValue('');
  }

  const removeTag = (gameTitle: string, tag: string) => {
    const updated = games.map((g) => {
      if (g.title !== gameTitle) return g;
      return { ...g, tags: (g.tags || []).filter((t) => t !== tag) };
    });
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
    } catch {} finally { setSaving(false); }
  };

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', top: '50%', left: '0.7rem', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search games to add…"
            style={{
              ...inputStyle({ paddingLeft: '2.1rem', paddingRight: search ? '2.4rem' : '0.85rem' }),
            }}
          />
          {search ? (
            <button onClick={() => { setSearch(''); setResults([]); }} style={{
              position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-soft)',
            }}><X size={15} /></button>
          ) : null}
        </div>

        {searching ? (
          <p style={{ ...TYPE.mono, fontSize: '0.66rem', color: 'var(--orange)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0.4rem 0 0' }}>
            <SpinnerInline size={12} /> Searching…
          </p>
        ) : null}

        {results.length > 0 ? (
          <div style={{
            marginTop: '0.35rem',
            background: 'var(--panel-mute)',
            border: '1px solid var(--rule)',
            maxHeight: '280px',
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
                    padding: '0.7rem 0.9rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--rule)',
                    color: alreadyAdded ? 'var(--ink-faint)' : 'var(--cream)',
                    ...TYPE.body,
                    fontSize: '0.88rem',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    opacity: alreadyAdded ? 0.5 : 1,
                    textAlign: 'left',
                  }}
                >
                  <span>{r.title}{alreadyAdded ? ' (added)' : ''}</span>
                  {r.minPlayers && r.maxPlayers ? (
                    <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem' }}>
                      {r.minPlayers}–{r.maxPlayers}p
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Manual add */}
      <div style={{ marginBottom: '1.25rem' }}>
        {!manualAdd ? (
          <button onClick={() => setManualAdd(true)} style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-soft)',
            ...TYPE.mono,
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: 0,
          }}>
            <Plus size={13} /> Add a game not in the database
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
              style={inputStyle()}
            />
            <Button size="sm" onClick={() => { if (manualTitle.trim()) addGame(manualTitle.trim()); }} disabled={!manualTitle.trim()}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setManualAdd(false); setManualTitle(''); }}><X size={14} /></Button>
          </div>
        )}
      </div>

      {/* Save status */}
      {(saving || saved) ? (
        <p style={{ ...TYPE.mono, color: saved ? 'var(--green)' : 'var(--ink-soft)', fontSize: '0.7rem', margin: '0 0 0.9rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {saving ? 'Saving…' : 'Saved'}
        </p>
      ) : null}

      {/* Filters */}
      {games.length > 1 ? (
        <div style={{ marginBottom: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div className="ar-chips">
            {[2, 3, 4, 5, 6].map((n) => {
              const on = playerFilter === n;
              return (
                <button key={n} onClick={() => setPlayerFilter(on ? null : n)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <Chip on={on}>{n === 6 ? '6+ players' : `${n} players`}</Chip>
                </button>
              );
            })}
          </div>
          <div className="ar-chips">
            {([
              ['quick', 'Under 30 min'],
              ['medium', '30–90 min'],
              ['long', 'Over 90 min'],
            ] as [TimeBand, string][]).map(([band, label]) => {
              const on = timeFilter === band;
              return (
                <button key={band} onClick={() => setTimeFilter(on ? null : band)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <Chip on={on}>{label}</Chip>
                </button>
              );
            })}
            {([
              ['light', 'Light'],
              ['mid', 'Medium'],
              ['heavy', 'Heavy'],
            ] as [WeightBand, string][]).map(([band, label]) => {
              const on = weightFilter === band;
              return (
                <button key={band} onClick={() => setWeightFilter(on ? null : band)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <Chip on={on}>{label}</Chip>
                </button>
              );
            })}
            {filtersActive ? (
              <button onClick={clearFilters} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                ...TYPE.mono, fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--ink-soft)', textDecoration: 'underline', textUnderlineOffset: '3px',
                paddingLeft: '0.4rem', alignSelf: 'center',
              }}>clear</button>
            ) : null}
          </div>
          {tagsByFrequency.length > 0 ? (
            <div className="ar-chips" style={{ marginTop: '0.15rem' }}>
              {tagsByFrequency.map(({ key, display, count }) => {
                const on = tagFilters.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTagFilter(key)}
                    title={`${count} ${count === 1 ? 'game' : 'games'} tagged ${display}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <Chip on={on}>#{display}</Chip>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Game list */}
      {games.length === 0 ? (
        <EmptyState
          title="Build your shelf"
          desc="Add the games you own. Stores can use this to recommend matches at the counter, and you can filter by player count, time, or complexity. Search above to start."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No games match" desc={`Your filters exclude all ${games.length} games. Try loosening them — games without play data can't match precise filters.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {filtered.map((game) => {
            const meta = formatMeta(game);
            return (
            <div key={game.title} style={{ padding: '0.85rem 1rem', background: 'var(--panel-mute)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...TYPE.displayMd, color: 'var(--cream)', fontSize: '0.95rem' }}>{game.title}</div>
                  {meta ? (
                    <div style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.66rem', letterSpacing: '0.06em', marginTop: '0.2rem' }}>{meta}</div>
                  ) : null}
                </div>
                <button onClick={() => removeGame(game.title)} title="Remove from library" style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--ink-faint)',
                }}><X size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                {(game.tags || []).map((tag) => (
                  <span key={tag} style={{
                    padding: '0.15rem 0.5rem',
                    background: 'var(--orange-weak)',
                    border: '1px solid var(--orange)',
                    color: 'var(--orange)',
                    ...TYPE.mono,
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    #{tag}
                    <button onClick={() => removeTag(game.title, tag)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--orange)', padding: 0, lineHeight: 1,
                    }}><X size={10} /></button>
                  </span>
                ))}
                {tagInputFor === game.title ? (() => {
                  const existingTagsOnGame = new Set((game.tags || []).map((t) => t.toLowerCase()));
                  const matchValue = tagInputValue.trim().toLowerCase();
                  const suggestions = tagsByFrequency
                    .filter((t) => !existingTagsOnGame.has(t.key))
                    .filter((t) => !matchValue || t.key.includes(matchValue))
                    .slice(0, 6);
                  return (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="text"
                        value={tagInputValue}
                        onChange={(e) => setTagInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitTagInput(); }
                          else if (e.key === 'Escape') { setTagInputFor(null); setTagInputValue(''); }
                        }}
                        onBlur={() => {
                          // Defer so a click on a suggestion fires before blur cancels.
                          setTimeout(() => {
                            if (document.activeElement?.tagName !== 'BUTTON') {
                              commitTagInput();
                            }
                          }, 120);
                        }}
                        placeholder="tag"
                        autoFocus
                        style={{
                          padding: '0.15rem 0.5rem',
                          background: 'var(--panel-mute)',
                          border: '1px solid var(--orange)',
                          color: 'var(--cream)',
                          ...TYPE.mono,
                          fontSize: '0.6rem',
                          letterSpacing: '0.08em',
                          width: '110px',
                          outline: 'none',
                        }}
                      />
                      {suggestions.length > 0 ? (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '2px',
                          background: 'var(--panel-mute)',
                          border: '1px solid var(--rule)',
                          minWidth: '140px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          zIndex: 10,
                        }}>
                          {suggestions.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              onMouseDown={(e) => {
                                // onMouseDown so blur of input fires AFTER this — input's
                                // blur-handler reads activeElement to detect this case.
                                e.preventDefault();
                                addTag(game.title, s.display);
                                setTagInputFor(null);
                                setTagInputValue('');
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.3rem 0.5rem',
                                background: 'transparent',
                                border: 'none',
                                ...TYPE.mono,
                                fontSize: '0.62rem',
                                letterSpacing: '0.05em',
                                color: 'var(--ink-soft)',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--orange)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-soft)'; }}
                            >
                              #{s.display} <span style={{ color: 'var(--ink-faint)' }}>· {s.count}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })() : (
                  <button onClick={() => { setTagInputFor(game.title); setTagInputValue(''); }} style={{
                    padding: '0.15rem 0.5rem',
                    background: 'transparent',
                    border: '1px dashed var(--rule)',
                    color: 'var(--ink-soft)',
                    ...TYPE.mono,
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                  }}>+ tag</button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
      {games.length > 0 ? (
        <p style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.68rem', margin: '0.75rem 0 0', textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {filtersActive ? `${filtered.length} of ${games.length} games` : `${games.length} ${games.length === 1 ? 'game' : 'games'}`}
        </p>
      ) : null}
    </div>
  );
}
