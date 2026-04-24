'use client';

import { useState, useRef } from 'react';
import { Camera, Check, X, Plus, Star, Users, Clock } from 'lucide-react';
import { Button, TYPE, SpinnerInline } from '@/app/components/ui';

interface ResolvedGame {
  title: string;
  bggId: number | null;
  slug: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTime: string | null;
  complexity: number | null;
  bggRating: number | null;
  yearPublished: number | null;
  thumbnail: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawGuess: string;
  bounds?: [number, number, number, number];
}

interface ShelfScannerProps {
  existingGames: string[];
  onAdd: (games: Array<{ title: string; slug?: string; bggId?: number }>) => void;
}

const confidenceTone: Record<ResolvedGame['confidence'], string> = {
  high: 'var(--green)',
  medium: 'var(--orange)',
  low: 'var(--ink-soft)',
};
const confidenceLabel: Record<ResolvedGame['confidence'], string> = {
  high: 'exact match',
  medium: 'likely',
  low: 'unverified',
};

export function ShelfScanner({ existingGames, onAdd }: ShelfScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ResolvedGame[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const [scanStats, setScanStats] = useState<{ totalVisible: number; identified: number; unidentified: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError('');
    setResults(null);

    try {
      const resized = await resizeImage(file);
      const res = await fetch('/api/library/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: resized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scan failed');
        if (data.scansRemaining !== undefined) setScansRemaining(data.scansRemaining);
        return;
      }

      const newGames = (data.games as ResolvedGame[]).filter(
        (g) => !existingGames.some((eg) => eg.toLowerCase() === g.title.toLowerCase())
      );
      setResults(newGames);
      setSelected(new Set(newGames.map((g) => g.title)));
      if (data.scansRemaining !== undefined) setScansRemaining(data.scansRemaining);
      setScanStats({ totalVisible: data.totalVisible || 0, identified: data.identified || 0, unidentified: data.unidentified || 0 });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleGame = (title: string) => {
    const next = new Set(selected);
    if (next.has(title)) next.delete(title); else next.add(title);
    setSelected(next);
  };

  const confirmAdd = () => {
    if (!results || selected.size === 0) return;
    const toAdd = results
      .filter((g) => selected.has(g.title))
      .map((g) => ({ title: g.title, slug: g.slug || undefined, bggId: g.bggId || undefined }));
    onAdd(toAdd);
    setResults(null);
    setSelected(new Set());
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

      {!results ? (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            width: '100%',
            padding: '0.9rem 1rem',
            background: scanning ? 'var(--panel)' : 'var(--orange-weak)',
            border: `2px dashed ${scanning ? 'var(--rule)' : 'var(--orange)'}`,
            color: scanning ? 'var(--ink-soft)' : 'var(--orange)',
            ...TYPE.display,
            fontSize: '0.9rem',
            letterSpacing: '0.03em',
            cursor: scanning ? 'wait' : 'pointer',
          }}
        >
          {scanning ? <><SpinnerInline size={16} /> Identifying games…</> : <><Camera size={18} /> Scan your game shelf</>}
        </button>
      ) : null}

      {error ? <p style={{ ...TYPE.body, color: 'var(--red)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{error}</p> : null}

      {scansRemaining !== null && scansRemaining < 999 && !results ? (
        <p style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.68rem', margin: '0.5rem 0 0', textAlign: 'center', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} remaining today
        </p>
      ) : null}

      {results ? (
        <div style={{ border: '2px solid var(--orange)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ ...TYPE.displayMd, margin: 0, color: 'var(--orange)', fontSize: '0.95rem' }}>
              {results.length > 0 ? `Found ${results.length} new game${results.length !== 1 ? 's' : ''}` : 'No new games found'}
            </h3>
            <button onClick={() => { setResults(null); setSelected(new Set()); setScanStats(null); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)',
            }}><X size={16} /></button>
          </div>

          {scanStats && scanStats.totalVisible > 0 ? (
            <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.72rem', margin: '0 0 0.5rem', letterSpacing: '0.04em' }}>
              {scanStats.identified} of {scanStats.totalVisible} visible game{scanStats.totalVisible !== 1 ? 's' : ''} identified
              {scanStats.unidentified > 0 ? ` · ${scanStats.unidentified} could not be read` : ''}
            </p>
          ) : null}

          <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.7rem', margin: '0 0 0.85rem', fontStyle: 'italic' }}>
            Results are AI-generated and may contain errors. Verify each title before adding.
          </p>

          {results.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.9rem' }}>
                {results.map((game) => {
                  const on = selected.has(game.title);
                  return (
                    <button key={game.title} onClick={() => toggleGame(game.title)} style={{
                      display: 'flex', alignItems: 'center', gap: '0.65rem',
                      padding: '0.6rem 0.7rem',
                      textAlign: 'left',
                      width: '100%',
                      background: on ? 'var(--orange-weak)' : 'var(--panel-mute)',
                      border: `1px solid ${on ? 'var(--orange)' : 'var(--rule)'}`,
                      color: 'var(--cream)',
                      cursor: 'pointer',
                    }}>
                      <div style={{
                        width: '18px', height: '18px', flexShrink: 0,
                        border: `2px solid ${on ? 'var(--orange)' : 'var(--ink-faint)'}`,
                        background: on ? 'var(--orange)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on ? <Check size={11} color="var(--void)" /> : null}
                      </div>
                      {game.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={game.thumbnail} alt="" width={36} height={36} style={{ objectFit: 'cover', flexShrink: 0 }} />
                      ) : null}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ ...TYPE.displayMd, fontSize: '0.9rem', color: 'var(--cream)' }}>{game.title}</span>
                          {game.yearPublished ? (
                            <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem' }}>({game.yearPublished})</span>
                          ) : null}
                          <span style={{
                            padding: '1px 6px',
                            ...TYPE.mono,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            background: `color-mix(in oklab, ${confidenceTone[game.confidence]} 12%, transparent)`,
                            color: confidenceTone[game.confidence],
                          }}>{confidenceLabel[game.confidence]}</span>
                        </div>
                        {game.rawGuess !== game.title ? (
                          <div style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.68rem', marginTop: '0.15rem' }}>
                            Detected: &quot;{game.rawGuess}&quot;
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {game.minPlayers && game.maxPlayers ? (
                            <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Users size={11} /> {game.minPlayers}–{game.maxPlayers}
                            </span>
                          ) : null}
                          {game.playTime ? (
                            <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Clock size={11} /> {game.playTime}
                            </span>
                          ) : null}
                          {game.bggRating ? (
                            <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Star size={11} /> {game.bggRating}
                            </span>
                          ) : null}
                          {game.complexity ? (
                            <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.7rem' }}>
                              Weight: {game.complexity}/5
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button onClick={confirmAdd} disabled={selected.size === 0}>
                <Plus size={16} /> Add {selected.size} game{selected.size !== 1 ? 's' : ''} to library
              </Button>
            </>
          ) : (
            <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.85rem', margin: 0 }}>
              Try a clearer photo with game spines/covers facing the camera.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
