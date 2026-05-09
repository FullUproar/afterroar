# HQ → afterroar.me /api/recs/games — integration notes

## What you get

Heimdall returns up to 50 ranked board game recommendations matched
against either a saved Passport profile (`player_id`) or an inline
24-dim vector (`player_profile`). v0.1 is seidr-only — Mimir/huginn/saga
return empty until their data thresholds land.

Each rec ships with everything HQ needs to render a card without an
extra BGG round-trip: `game_name`, `year`, `subdomain`, `categories`,
`description`, `min_players`, `max_players`, `playing_time`, `score`,
`rank`, plus the per-dim explanation chips (`top_dim_contributions`,
`all_dim_contributions`).

## Auth

`X-API-Key: ar_live_…` with `recs:read` scope. The existing fu-site key
(`ar_live_jZO52JIW…`) was extended with this scope on 2026-05-09 — same
key already used for `read:users` etc. on the FU side.

## Sample TypeScript client

```ts
// HQ-side helper. Drop into full-uproar-site/packages/afterroar-client/
// or wherever HQ already keeps its afterroar.me callers.

interface RecsRequest {
  playerId?: string;          // Passport user id — uses their saved seidr profile
  playerProfile?: Record<string, number>;  // OR an inline 24-dim vector
  context?: {
    playerCount?: number;     // Filter games whose range excludes this
    excludeGameIds?: number[];
  };
  limit?: number;             // Default 12, max 50
}

interface RecsResponse {
  recommendations: Array<{
    game_id: number;
    game_name: string;
    year: number | null;
    subdomain: string | null;     // Strategy / Family / Party / Wargame / etc.
    categories: string[];         // Up to 3 BGG categories
    description: string | null;   // 400-char snippet
    min_players: number | null;
    max_players: number | null;
    playing_time: number | null;
    score: number;
    rank: number;
    contributions: { seidr?: number; mimir?: number; huginn?: number; saga?: number };
    top_dim_contributions: Array<{
      dim: string;
      contribution: number;
      player: number;
      game: number;
      kind: 'agree_high' | 'agree_low' | 'disagree' | 'neutral';
    }>;
    all_dim_contributions: Array<{ /* same shape, full 5 */ }>;
    explanation?: string;
  }>;
  engines_ran: Array<'mimir' | 'seidr' | 'huginn' | 'saga'>;
  engines_skipped: Array<{ name: string; reason: string }>;
  candidates_considered: number;
}

export async function fetchRecs(req: RecsRequest, apiKey: string): Promise<RecsResponse> {
  const res = await fetch('https://www.afterroar.me/api/recs/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      player_id: req.playerId,
      player_profile: req.playerProfile,
      context: req.context && {
        player_count: req.context.playerCount,
        exclude_game_ids: req.context.excludeGameIds,
      },
      limit: req.limit,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`afterroar recs failed: ${res.status} ${body}`);
  }
  return res.json();
}
```

## When `engines_skipped` is more interesting than `recommendations`

If the response has empty `recommendations` and `engines_skipped` says
`{ name: 'seidr', reason: 'no player profile available' }`, the user
hasn't taken the quiz yet. Surface a "Take the 5-minute quiz" link
to `https://www.afterroar.me/quiz` in the UI.

## What's not in this endpoint (yet)

- Mood deltas / hard filters / signal exclusions — those are quiz-only
  via `/api/quiz/recommend`. Server-to-server callers requesting them
  is a v0.2 add (the orchestrator already supports them; just not
  plumbed through this route). Tell us when HQ wants them.
- Game search — separate `/api/recs/games/search?q=...&limit=10` (no auth).
