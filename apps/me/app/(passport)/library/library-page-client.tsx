'use client';

import { useState } from 'react';
import { LibraryEditor } from './library-editor';
import { BGGImport } from './bgg-import';

// Shelf scanner (shelf-scanner.tsx + /api/library/scan) intentionally unmounted
// while vision quality is sub-par. Code preserved for easy revival.

interface GameEntry {
  title: string;
  slug?: string;
  bggId?: number;
  tags?: string[];
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayMinutes?: number | null;
  maxPlayMinutes?: number | null;
  complexity?: number | null;
}

export function LibraryPageClient({ initialGames }: { initialGames: GameEntry[] }) {
  const [games, setGames] = useState<GameEntry[]>(initialGames);

  const handleBulkAdd = async (newGames: Array<{ title: string; slug?: string; bggId?: number }>) => {
    const deduped = newGames.filter(
      (ng) => !games.some((g) => g.title.toLowerCase() === ng.title.toLowerCase())
    );
    if (deduped.length === 0) return;

    const updated = [...games, ...deduped];
    setGames(updated);

    await fetch('/api/library/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: updated }),
    });
  };

  return (
    <>
      <BGGImport existingGames={games.map((g) => g.title)} onImport={handleBulkAdd} />
      <LibraryEditor key={games.length} initialGames={games} />
    </>
  );
}
