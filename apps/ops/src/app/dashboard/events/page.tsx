'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { GameEvent, EventCheckin, Customer, formatCents, parseDollars } from '@/lib/types';
import { StatusBadge } from '@/components/mobile-card';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SubNav } from '@/components/ui/sub-nav';
import { EVENTS_TABS } from '@/lib/nav-groups';

type EventWithCount = GameEvent & { checkin_count: number; rsvp_count: number | null };

/* ------------------------------------------------------------------ */
/*  Tournament types (mirrored from tournaments page)                  */
/* ------------------------------------------------------------------ */

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

const FORMAT_OPTIONS = [
  'standard', 'modern', 'commander', 'draft', 'sealed',
  'pioneer', 'pauper', 'legacy', 'vintage', 'other',
];

interface HQGuest {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  status: string;
  attended: boolean;
  noShow: boolean;
  trustBadge: { level: 'green' | 'yellow' | 'red'; label: string };
  identityVerified: boolean;
  checkedIn: boolean;
  reputationScore: number | null;
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

function trustBadgeStyle(level: 'green' | 'yellow' | 'red'): React.CSSProperties {
  const map = {
    green: { color: 'var(--teal)', background: 'var(--teal-mute)', border: '1px solid var(--teal)' },
    yellow: { color: 'var(--yellow)', background: 'var(--yellow-mute)', border: '1px solid var(--yellow)' },
    red: { color: 'var(--red)', background: 'var(--red-mute)', border: '1px solid var(--red)' },
  } as const;
  return {
    ...map[level],
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    padding: '2px 6px',
  };
}

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

function statusBadge(event: EventWithCount) {
  const now = new Date();
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;

  if (end && now > end) {
    return <StatusBadge variant="info">Past</StatusBadge>;
  }
  if (now >= start) {
    return <StatusBadge variant="success">Active</StatusBadge>;
  }
  return <StatusBadge variant="pending">Upcoming</StatusBadge>;
}

function typeBadge(type: string) {
  const variants: Record<string, 'special' | 'pending' | 'error' | 'success' | 'info'> = {
    fnm: 'special',
    prerelease: 'pending',
    tournament: 'error',
    casual: 'success',
    draft: 'info',
    league: 'info',
  };
  return (
    <StatusBadge variant={variants[type] || 'info'} className="uppercase">
      {type}
    </StatusBadge>
  );
}

export default function EventsPage() {
  const { store } = useStore();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [createAsHQ, setCreateAsHQ] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    event_type: 'fnm',
    starts_at: '',
    ends_at: '',
    entry_fee: '',
    max_players: '',
    description: '',
    // Tournament fields
    format: '',
    bracket_type: 'swiss' as 'swiss' | 'single_elimination',
  });
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const settings = (store?.settings ?? {}) as Record<string, unknown>;
  const isConnected = Boolean(settings.venueId);
  const venueName = settings.venueName as string | undefined;

  const loadEvents = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch(`/api/events?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) {
        setLoadError('Failed to load events. Try again.');
        return;
      }
      const result = await res.json();
      setEvents(result.data || result);
      if (result.total != null) setTotalItems(result.total);
    } catch {
      setLoadError('Failed to load events. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const isTournamentType = form.event_type === 'tournament' || form.event_type === 'fnm';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const weeks = repeatWeekly ? repeatWeeks : 1;
      for (let w = 0; w < weeks; w++) {
        const startOffset = w * 7 * 86400000;
        const startsAt = form.starts_at ? new Date(new Date(form.starts_at).getTime() + startOffset).toISOString() : "";
        const endsAt = form.ends_at ? new Date(new Date(form.ends_at).getTime() + startOffset).toISOString() : null;

        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            event_type: form.event_type,
            starts_at: startsAt,
            ends_at: endsAt,
            entry_fee_cents: form.entry_fee ? parseDollars(form.entry_fee) : 0,
            max_players: form.max_players ? parseInt(form.max_players) : null,
            description: form.description || null,
            create_hq_event: createAsHQ && w === 0, // Only create HQ event for the first one
          }),
        });

        // Auto-create linked tournament for tournament/fnm event types
        if (res.ok && isTournamentType) {
          const event = await res.json();
          await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              format: form.format || null,
              bracket_type: form.bracket_type,
              max_players: form.max_players ? parseInt(form.max_players) : null,
              event_id: event.id,
            }),
          });
        }
      }
      setForm({ name: '', event_type: 'fnm', starts_at: '', ends_at: '', entry_fee: '', max_players: '', description: '', format: '', bracket_type: 'swiss' });
      setShowForm(false);
      setCreateAsHQ(false);
      setRepeatWeekly(false);
      loadEvents();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={EVENTS_TABS} />
      <div className="space-y-1">
        <PageHeader
          title="Events"
          crumb="Console · Floor"
          desc="In-store play, tournaments, leagues, drafts. RSVPs, check-ins, and brackets in one panel."
          action={
            <div className="flex flex-wrap gap-2 justify-end">
              <div className="flex overflow-hidden" style={{ border: '1px solid var(--rule-hi)' }}>
                <button
                  onClick={() => setViewMode("list")}
                  className="font-mono uppercase transition-colors"
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    padding: '0 0.85rem',
                    minHeight: 44,
                    color: viewMode === "list" ? 'var(--orange)' : 'var(--ink-soft)',
                    background: viewMode === "list" ? 'var(--orange-mute)' : 'var(--panel)',
                  }}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className="font-mono uppercase transition-colors"
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    padding: '0 0.85rem',
                    minHeight: 44,
                    color: viewMode === "calendar" ? 'var(--orange)' : 'var(--ink-soft)',
                    background: viewMode === "calendar" ? 'var(--orange-mute)' : 'var(--panel)',
                    borderLeft: '1px solid var(--rule-hi)',
                  }}
                >
                  Calendar
                </button>
              </div>
              <Link
                href="/dashboard/deck-builder"
                className="hidden sm:inline-flex items-center font-mono uppercase transition-colors"
                style={ghostBtnStyle}
              >
                Deck Builder
              </Link>
              {isConnected && (
                <button
                  onClick={() => { setShowForm(true); setCreateAsHQ(true); }}
                  className="hidden sm:inline-flex items-center font-mono uppercase transition-colors"
                  style={{
                    ...ghostBtnStyle,
                    color: 'var(--orange)',
                    border: '1px solid var(--orange)',
                  }}
                >
                  New Afterroar Event
                </button>
              )}
              <button
                onClick={() => { setShowForm(!showForm); setCreateAsHQ(false); }}
                className="inline-flex items-center font-display uppercase transition-colors shrink-0"
                style={primaryBtnStyle}
              >
                {showForm && !createAsHQ ? 'Cancel' : 'New'}
              </button>
            </div>
          }
        />
        {isConnected ? (
          <p className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="ar-led" style={{ fontSize: '0.6rem' }}>
                <span className="ar-led-dot" />
              </span>
              Connected to {venueName || 'Afterroar'}
            </span>
          </p>
        ) : (
          <p className="font-mono text-ink-faint" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
            Connect to the Afterroar Network in{' '}
            <a href="/dashboard/settings" className="text-orange hover:underline">Settings</a>
            {' '}to enable online RSVPs, player identity linking, and cross-store leaderboards.
          </p>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="ar-zone">
          <div className="ar-zone-head">
            <span>{createAsHQ ? 'New Afterroar Event' : 'New Event'}</span>
          </div>
          <div className="p-5 space-y-4">
            {createAsHQ && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: 'var(--orange-mute)', border: '1px solid var(--orange)', color: 'var(--orange)' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--orange)' }} />
                <span className="font-mono uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.14em', fontWeight: 700 }}>
                  This event will also appear on your Afterroar store page · Players can RSVP online
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Event Type
                </label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="fnm">FNM</option>
                  <option value="prerelease">Prerelease</option>
                  <option value="tournament">Tournament</option>
                  <option value="casual">Casual</option>
                  <option value="draft">Draft</option>
                  <option value="league">League</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Starts At
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Ends At
                </label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Entry Fee ($)
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={form.entry_fee}
                  onChange={(e) => setForm({ ...form, entry_fee: e.target.value })}
                  className="font-mono tabular-nums"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                  Max Players
                </label>
                <input
                  type="number"
                  value={form.max_players}
                  onChange={(e) => setForm({ ...form, max_players: e.target.value })}
                  className="font-mono tabular-nums"
                  style={inputStyle}
                />
              </div>
              {isTournamentType && (
                <>
                  <div>
                    <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      Format
                    </label>
                    <select
                      value={form.format}
                      onChange={(e) => setForm({ ...form, format: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select format...</option>
                      {FORMAT_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      Bracket Type
                    </label>
                    <div className="flex" style={{ border: '1px solid var(--rule-hi)' }}>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, bracket_type: 'swiss' })}
                        className="flex-1 font-mono uppercase transition-colors"
                        style={{
                          fontSize: '0.7rem',
                          letterSpacing: '0.14em',
                          fontWeight: 700,
                          padding: '0.55rem 0.5rem',
                          minHeight: 44,
                          color: form.bracket_type === 'swiss' ? 'var(--orange)' : 'var(--ink-soft)',
                          background: form.bracket_type === 'swiss' ? 'var(--orange-mute)' : 'var(--panel)',
                        }}
                      >
                        Swiss
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, bracket_type: 'single_elimination' })}
                        className="flex-1 font-mono uppercase transition-colors"
                        style={{
                          fontSize: '0.7rem',
                          letterSpacing: '0.14em',
                          fontWeight: 700,
                          padding: '0.55rem 0.5rem',
                          minHeight: 44,
                          color: form.bracket_type === 'single_elimination' ? 'var(--orange)' : 'var(--ink-soft)',
                          background: form.bracket_type === 'single_elimination' ? 'var(--orange-mute)' : 'var(--panel)',
                          borderLeft: '1px solid var(--rule-hi)',
                        }}
                      >
                        Single Elim
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, minHeight: 60 }}
              />
            </div>
            {/* Repeat weekly toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRepeatWeekly(!repeatWeekly)}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{
                  background: repeatWeekly ? 'var(--orange)' : 'var(--rule-hi)',
                  minHeight: 'auto',
                }}
              >
                <span
                  className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
                  style={{
                    background: 'var(--ink)',
                    transform: repeatWeekly ? 'translateX(16px)' : 'translateX(0)',
                  }}
                />
              </button>
              <span className="text-sm text-ink">Repeat weekly</span>
              {repeatWeekly && (
                <span className="flex items-center gap-1 text-sm text-ink-soft">
                  for
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Math.min(12, Math.max(2, parseInt(e.target.value) || 4)))}
                    className="w-12 font-mono tabular-nums text-center"
                    style={{ ...inputStyle, padding: '0.3rem 0.4rem' }}
                  />
                  weeks
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={primaryBtnStyle}
              >
                {saving ? 'Creating...' : repeatWeekly ? `Create ${repeatWeeks} Events` : createAsHQ ? 'Create Afterroar Event' : 'Create Event'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setCreateAsHQ(false); }}
                className="inline-flex items-center font-mono uppercase transition-colors"
                style={ghostBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loadError && (
        <div
          className="p-4 text-center"
          style={{ border: '1px solid var(--red)', background: 'var(--red-mute)' }}
        >
          <p className="text-sm text-red-fu">{loadError}</p>
          <button
            onClick={() => { setLoadError(null); loadEvents(); }}
            className="mt-2 font-mono uppercase text-red-fu hover:underline"
            style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 700 }}
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.06em' }}>Loading events...</p>
      ) : events.length === 0 && !loadError ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Events</span><span>No results</span></div>
          <div className="p-10 text-center">
            <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.66rem', letterSpacing: '0.28em' }}>
              No events yet
            </p>
            <p className="font-display text-ink mb-1" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Create your first event
            </p>
            <p className="text-ink-soft mb-4 max-w-md mx-auto" style={{ fontSize: '0.85rem' }}>
              Track attendance, manage check-ins, and run brackets.
            </p>
            <button
              onClick={() => { setShowForm(true); setCreateAsHQ(false); }}
              className="inline-flex items-center font-display uppercase transition-colors"
              style={primaryBtnStyle}
            >
              Create Your First Event
            </button>
          </div>
        </div>
      ) : viewMode === "calendar" ? (
        <EventCalendar events={events} expandedId={expandedId} onEventClick={(id) => setExpandedId(expandedId === id ? null : id)} />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {events.map((event) => (
              <div key={event.id}>
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="ar-stripe ar-lstripe w-full p-4 text-left transition-colors hover:bg-panel"
                  style={{
                    background: 'var(--panel-mute)',
                    border: '1px solid var(--rule)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-ink truncate mr-2 leading-snug" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                      {event.name}
                      {Boolean(event.afterroar_event_id) && (
                        <StatusBadge variant="special" className="ml-1.5 text-[10px]">AR</StatusBadge>
                      )}
                    </span>
                    {statusBadge(event)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    {typeBadge(event.event_type)}
                    <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                    <span>{event.checkin_count} players</span>
                  </div>
                </button>
                {expandedId === event.id && (
                  <div className="px-4 py-3" style={{ background: 'var(--panel-mute)', borderLeft: '1px solid var(--rule)', borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
                    <MobileEventDetail event={event} />
                  </div>
                )}
              </div>
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
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date/Time</th>
                  <th className="px-4 py-3">Entry Fee</th>
                  <th className="px-4 py-3">Players</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        </>
      )}
    </div>
  );
}

function MobileEventDetail({ event }: { event: EventWithCount }) {
  const isHQLinked = Boolean(event.afterroar_event_id);
  const isTournamentEvent = event.event_type === 'tournament' || event.event_type === 'fnm';
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between font-mono text-ink-soft" style={{ fontSize: '0.74rem' }}>
        <span>Entry Fee: <span className="tabular-nums text-ink">{event.entry_fee_cents > 0 ? formatCents(event.entry_fee_cents) : 'Free'}</span></span>
        <span>{new Date(event.starts_at).toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 font-mono text-ink-soft" style={{ fontSize: '0.74rem' }}>
        <span>Players: <span className="tabular-nums text-ink">{event.checkin_count}</span></span>
        {event.rsvp_count !== null && <span className="text-ink-faint">({event.rsvp_count} RSVP)</span>}
      </div>
      {isHQLinked && (
        <div className="flex items-center gap-1.5 font-mono uppercase text-orange" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--orange)' }} />
          Afterroar linked event
        </div>
      )}
      {event.description && (
        <p className="text-ink-soft" style={{ fontSize: '0.78rem' }}>{event.description}</p>
      )}
      {isTournamentEvent && (
        <InlineTournamentPanel eventId={event.id} />
      )}
    </div>
  );
}

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: EventWithCount;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [checkins, setCheckins] = useState<(EventCheckin & { customer_name?: string })[]>([]);
  const [hqGuests, setHqGuests] = useState<HQGuest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loadingGuests, setLoadingGuests] = useState(false);

  const isHQLinked = Boolean(event.afterroar_event_id);

  useEffect(() => {
    if (expanded) {
      fetch(`/api/events/${event.id}/checkin`)
        .then((r) => r.json())
        .then(setCheckins)
        .catch(() => {});

      if (isHQLinked) {
        setLoadingGuests(true);
        fetch(`/api/events/${event.id}/guests`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setHqGuests(data);
          })
          .catch(() => {})
          .finally(() => setLoadingGuests(false));
      }
    }
  }, [expanded, event.id, isHQLinked]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function handleCheckin(customerId: string) {
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/events/${event.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        const updatedRes = await fetch(`/api/events/${event.id}/checkin`);
        if (updatedRes.ok) setCheckins(await updatedRes.json());
      }
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleQRCheckin(guestId: string) {
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/events/${event.id}/qr-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId }),
      });
      if (res.ok) {
        const [checkinRes, guestRes] = await Promise.all([
          fetch(`/api/events/${event.id}/checkin`),
          fetch(`/api/events/${event.id}/guests`),
        ]);
        if (checkinRes.ok) setCheckins(await checkinRes.json());
        if (guestRes.ok) {
          const data = await guestRes.json();
          if (Array.isArray(data)) setHqGuests(data);
        }
      }
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-panel cursor-pointer text-ink"
        style={{ borderTop: '1px solid var(--rule-faint)' }}
      >
        <td className="px-4 py-3 font-display" style={{ fontWeight: 500 }}>
          <span className="flex items-center gap-2">
            {event.name}
            {isHQLinked && (
              <StatusBadge variant="special" className="text-[10px]">Afterroar</StatusBadge>
            )}
          </span>
        </td>
        <td className="px-4 py-3">{typeBadge(event.event_type)}</td>
        <td className="px-4 py-3 font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.78rem' }}>
          {new Date(event.starts_at).toLocaleString()}
        </td>
        <td className="px-4 py-3 font-mono text-ink-soft tabular-nums">
          {event.entry_fee_cents > 0 ? formatCents(event.entry_fee_cents) : 'Free'}
        </td>
        <td className="px-4 py-3 font-mono text-ink-soft tabular-nums">
          <span>{event.checkin_count}</span>
          {event.rsvp_count !== null && (
            <span className="text-ink-faint ml-1">/ {event.rsvp_count} RSVP</span>
          )}
        </td>
        <td className="px-4 py-3">{statusBadge(event)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4" style={{ background: 'var(--slate)', borderTop: '1px solid var(--rule)' }}>
            <div className="space-y-4">
              {isHQLinked && (
                <div>
                  <h3 className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                    RSVP Guest List
                    {loadingGuests && <span className="ml-2 text-ink-soft normal-case font-normal">Loading...</span>}
                  </h3>
                  {hqGuests.length > 0 ? (
                    <div className="space-y-1">
                      {hqGuests.map((guest) => (
                        <div
                          key={guest.id}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                          style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
                        >
                          <div className="flex items-center gap-2">
                            {guest.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={guest.avatarUrl}
                                alt=""
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full flex items-center justify-center font-mono text-xs text-ink-soft" style={{ background: 'var(--panel)' }}>
                                {guest.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-ink">{guest.name}</span>
                            <span style={trustBadgeStyle(guest.trustBadge.level)}>
                              {guest.trustBadge.label}
                            </span>
                            {guest.identityVerified && (
                              <StatusBadge variant="info" className="text-[10px]">Verified</StatusBadge>
                            )}
                            <span className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em' }}>{guest.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {guest.checkedIn ? (
                              <span className="font-mono uppercase text-teal" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                                Checked In
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQRCheckin(guest.id);
                                }}
                                disabled={checkingIn}
                                className="inline-flex items-center font-mono uppercase transition-colors disabled:opacity-50"
                                style={{
                                  fontSize: '0.62rem',
                                  letterSpacing: '0.14em',
                                  fontWeight: 700,
                                  padding: '0 0.7rem',
                                  minHeight: 36,
                                  color: 'var(--void)',
                                  background: 'var(--teal)',
                                  border: '1px solid var(--teal)',
                                }}
                              >
                                Check In
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !loadingGuests ? (
                    <p className="font-mono text-ink-soft" style={{ fontSize: '0.78rem' }}>No RSVPs yet.</p>
                  ) : null}
                </div>
              )}

              <div>
                <h3 className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                  {isHQLinked ? 'Walk-in Check-In' : 'Check-In Players'}
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                    style={inputStyle}
                  />
                  {searching && (
                    <p className="font-mono uppercase text-ink-faint mt-1" style={{ fontSize: '0.62rem', letterSpacing: '0.18em' }}>Searching...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div
                      className="absolute z-10 mt-1 w-full max-w-md shadow-xl"
                      style={{ background: 'var(--panel)', border: '1px solid var(--rule)' }}
                    >
                      {searchResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleCheckin(c.id)}
                          disabled={checkingIn}
                          className="w-full text-left px-3 py-2 hover:bg-panel-hi text-sm text-ink flex justify-between items-center transition-colors"
                          style={{ minHeight: 44 }}
                        >
                          <span className="font-display">{c.name}</span>
                          <span className="font-mono text-ink-soft" style={{ fontSize: '0.7rem' }}>{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {checkins.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                    Checked In ({checkins.length})
                  </p>
                  {checkins.map((ci) => (
                    <div
                      key={ci.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                      style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
                    >
                      <span className="text-ink">{ci.customer_name || ci.customer_id}</span>
                      <span className="font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.7rem' }}>
                        {new Date(ci.checked_in_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-ink-soft" style={{ fontSize: '0.78rem' }}>No players checked in yet.</p>
              )}

              {/* Inline tournament management for tournament/fnm events */}
              {(event.event_type === 'tournament' || event.event_type === 'fnm') && (
                <InlineTournamentPanel eventId={event.id} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Tournament Panel — embedded in event detail                 */
/* ------------------------------------------------------------------ */

function InlineTournamentPanel({ eventId }: { eventId: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [creatingTournament, setCreatingTournament] = useState(false);

  // Round timer
  const [roundStartTime, setRoundStartTime] = useState<Date | null>(null);
  const [roundMinutes, setRoundMinutes] = useState(50);
  const [timerDisplay, setTimerDisplay] = useState('');

  // Report match
  const [reportMatch, setReportMatch] = useState<TournamentMatch | null>(null);
  const [reportWinnerId, setReportWinnerId] = useState('');
  const [reportP1Score, setReportP1Score] = useState('0');
  const [reportP2Score, setReportP2Score] = useState('0');
  const [reporting, setReporting] = useState(false);

  const loadTournament = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments?event_id=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        // Find the tournament linked to this event
        const linked = Array.isArray(data)
          ? data.find((t: Tournament) => t.event_id === eventId)
          : null;
        if (linked) {
          // Fetch full detail
          const detailRes = await fetch(`/api/tournaments/${linked.id}`);
          if (detailRes.ok) {
            setTournament(await detailRes.json());
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadTournament(); }, [loadTournament]);

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

  async function handleCreateTournament() {
    setCreatingTournament(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tournament',
          bracket_type: 'swiss',
          event_id: eventId,
        }),
      });
      if (res.ok) {
        loadTournament();
      }
    } finally {
      setCreatingTournament(false);
    }
  }

  async function handleAddPlayer() {
    if (!tournament || !playerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_player', player_name: playerName.trim() }),
      });
      if (res.ok) {
        setPlayerName('');
        const detailRes = await fetch(`/api/tournaments/${tournament.id}`);
        if (detailRes.ok) setTournament(await detailRes.json());
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleStart() {
    if (!tournament) return;
    const action = tournament.bracket_type === "swiss" ? "start_swiss" : "start";
    const res = await fetch(`/api/tournaments/${tournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setTournament(await res.json());
      setRoundStartTime(new Date());
    }
  }

  async function handleNextRound() {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'next_round' }),
    });
    if (res.ok) {
      setTournament(await res.json());
      setRoundStartTime(new Date());
    }
  }

  async function handleDropPlayer(playerId: string) {
    if (!tournament) return;
    await fetch(`/api/tournaments/${tournament.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'drop_player', player_id: playerId }),
    });
    const detailRes = await fetch(`/api/tournaments/${tournament.id}`);
    if (detailRes.ok) setTournament(await detailRes.json());
  }

  async function handleReportMatch() {
    if (!tournament || !reportMatch || !reportWinnerId) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
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
        setTournament(await res.json());
        setReportMatch(null);
        setReportWinnerId('');
        setReportP1Score('0');
        setReportP2Score('0');
      }
    } finally {
      setReporting(false);
    }
  }

  function getPlayerName(playerId: string | null): string {
    if (!playerId || !tournament?.players) return 'BYE';
    return tournament.players.find((p) => p.id === playerId)?.player_name || 'Unknown';
  }

  if (loading) return <p className="font-mono text-ink-soft mt-2" style={{ fontSize: '0.74rem' }}>Loading tournament...</p>;

  // No tournament linked yet - offer to create one
  if (!tournament) {
    return (
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <button
          onClick={handleCreateTournament}
          disabled={creatingTournament}
          className="inline-flex items-center font-mono uppercase transition-colors disabled:opacity-50"
          style={{
            fontSize: '0.66rem',
            letterSpacing: '0.18em',
            fontWeight: 700,
            padding: '0 0.85rem',
            minHeight: 44,
            color: 'var(--void)',
            background: 'var(--orange)',
            border: '1px solid var(--orange)',
          }}
        >
          {creatingTournament ? 'Creating...' : 'Create Tournament Bracket'}
        </button>
        <p className="font-mono text-ink-faint mt-1" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>
          Add a tournament bracket to manage pairings, rounds, and standings.
        </p>
      </div>
    );
  }

  const players = tournament.players || [];
  const matches = tournament.matches || [];
  const rounds: Record<number, TournamentMatch[]> = {};
  matches.forEach((m) => {
    if (!rounds[m.round_number]) rounds[m.round_number] = [];
    rounds[m.round_number].push(m);
  });
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

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
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--rule)' }}>
      {/* Tournament header - collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
        style={{ minHeight: 'auto' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
            Tournament
          </span>
          <span style={tournamentStatusStyle(tournament.status)}>
            {tournament.status}
          </span>
          {tournament.format && (
            <span className="font-mono text-ink-soft" style={{ fontSize: '0.7rem' }}>{tournament.format}</span>
          )}
          {tournament.current_round > 0 && (
            <span className="font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.7rem' }}>
              Round {tournament.current_round}/{tournament.total_rounds}
            </span>
          )}
          <span className="font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.7rem' }}>
            {players.filter((p) => !p.dropped).length} players
          </span>
        </div>
        <span className="font-mono text-ink-faint" style={{ fontSize: '0.7rem' }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Registration phase: add players */}
          {tournament.status === 'registration' && (
            <div className="space-y-3">
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
                  Add
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
              {players.length >= 2 && (
                <button
                  onClick={handleStart}
                  className="inline-flex items-center font-display uppercase transition-colors"
                  style={tealBtnStyle}
                >
                  Start Tournament ({players.length} players)
                </button>
              )}
            </div>
          )}

          {/* Active / Completed: Bracket */}
          {(tournament.status === 'active' || tournament.status === 'completed') && roundNumbers.length > 0 && (
            <div>
              <h4 className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>Bracket</h4>
              <div className="flex gap-6 overflow-x-auto pb-2 scroll-visible">
                {roundNumbers.map((round) => (
                  <div key={round} style={{ minWidth: 200 }}>
                    <h5 className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                      {round === (tournament.total_rounds || 1) ? 'Finals' : `Round ${round}`}
                    </h5>
                    <div className="space-y-3">
                      {rounds[round].map((match) => {
                        const isActive = match.status === 'pending' && match.player1_id && match.player2_id;
                        return (
                          <div
                            key={match.id}
                            className="text-sm"
                            style={{
                              background: match.status === 'completed' ? 'var(--panel)' : isActive ? 'var(--orange-mute)' : 'var(--panel-mute)',
                              border: `1px solid ${match.status === 'completed' ? 'var(--rule-hi)' : isActive ? 'var(--orange)' : 'var(--rule)'}`,
                            }}
                          >
                            <div
                              className="px-2 py-1.5 flex items-center justify-between"
                              style={{
                                color: match.winner_id === match.player1_id ? 'var(--teal)' : 'var(--ink)',
                                fontWeight: match.winner_id === match.player1_id ? 600 : 400,
                                borderBottom: '1px solid var(--rule)',
                              }}
                            >
                              <span className="text-xs">{match.player1_id ? getPlayerName(match.player1_id) : 'TBD'}</span>
                              {match.status === 'completed' && <span className="font-mono tabular-nums text-ink-soft" style={{ fontSize: '0.65rem' }}>{match.player1_score}</span>}
                            </div>
                            <div
                              className="px-2 py-1.5 flex items-center justify-between"
                              style={{
                                color: match.winner_id === match.player2_id ? 'var(--teal)' : 'var(--ink)',
                                fontWeight: match.winner_id === match.player2_id ? 600 : 400,
                              }}
                            >
                              <span className="text-xs">{match.player2_id ? getPlayerName(match.player2_id) : 'TBD'}</span>
                              {match.status === 'completed' && <span className="font-mono tabular-nums text-ink-soft" style={{ fontSize: '0.65rem' }}>{match.player2_score}</span>}
                            </div>
                            {isActive && tournament.status === 'active' && (
                              <div className="px-2 py-1" style={{ borderTop: '1px solid var(--rule)' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                                  <span className="font-mono text-ink-faint ml-2" style={{ fontSize: '0.6rem' }}>{match.table_number}</span>
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

          {/* Round Timer + Next Round (Swiss) */}
          {tournament.status === "active" && tournament.bracket_type === "swiss" && (
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
            >
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div
                    className={`font-mono tabular-nums ${timerDisplay === "TIME!" ? "animate-pulse" : ""}`}
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: timerDisplay === "TIME!" ? 'var(--red)' : 'var(--ink)',
                    }}
                  >
                    {timerDisplay || "--:--"}
                  </div>
                  <div className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>Round Timer</div>
                </div>
                {!roundStartTime && (
                  <button
                    onClick={() => setRoundStartTime(new Date())}
                    className="inline-flex items-center font-mono uppercase transition-colors"
                    style={{
                      fontSize: '0.62rem',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      padding: '0 0.7rem',
                      minHeight: 36,
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
                    className="w-12 font-mono tabular-nums text-center"
                    style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.78rem', minHeight: 36 }}
                  />
                  <span className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>min</span>
                </div>
              </div>
              <div>
                {(() => {
                  const currentRoundMatches = rounds[tournament.current_round] || [];
                  const allComplete = currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.status === "completed");
                  return allComplete ? (
                    <button
                      onClick={handleNextRound}
                      className="inline-flex items-center font-display uppercase transition-colors"
                      style={{
                        fontSize: '0.7rem',
                        letterSpacing: '0.06em',
                        fontWeight: 700,
                        padding: '0 0.85rem',
                        minHeight: 36,
                        color: 'var(--void)',
                        background: 'var(--teal)',
                        border: '1px solid var(--teal)',
                      }}
                    >
                      {tournament.current_round >= (tournament.total_rounds || 99) ? "Finalize" : `Round ${tournament.current_round + 1}`}
                    </button>
                  ) : (
                    <span className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                      {currentRoundMatches.filter((m) => m.status !== "completed").length} pending
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Standings */}
          {(tournament.status === 'active' || tournament.status === 'completed') && standings.length > 0 && (
            <div>
              <h4 className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                {tournament.status === 'completed' ? 'Final Standings' : 'Standings'}
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono uppercase text-ink-faint text-left" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                    <th className="pb-1">#</th>
                    <th className="pb-1">Player</th>
                    <th className="pb-1 text-center">W</th>
                    <th className="pb-1 text-center">L</th>
                    <th className="pb-1 text-center">D</th>
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
                      <td className="py-1 font-mono tabular-nums text-xs">{p.standing || i + 1}</td>
                      <td className="py-1 text-xs font-display" style={{ fontWeight: 500 }}>
                        {p.player_name}
                        {p.standing === 1 && tournament.status === 'completed' && (
                          <span
                            className="ml-1 font-mono uppercase"
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
                            Champ
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-xs text-center font-mono tabular-nums text-teal">{p.wins}</td>
                      <td className="py-1 text-xs text-center font-mono tabular-nums text-red-fu">{p.losses}</td>
                      <td className="py-1 text-xs text-center font-mono tabular-nums text-ink-soft">{p.draws}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Event Calendar — monthly grid view                                 */
/* ------------------------------------------------------------------ */

function EventCalendar({ events, expandedId, onEventClick }: { events: EventWithCount[]; expandedId: string | null; onEventClick: (id: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build calendar grid
  const cells: Array<{ day: number | null; events: EventWithCount[] }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, events: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = events.filter((e) => {
      const eDate = new Date(e.starts_at);
      return eDate.getFullYear() === year && eDate.getMonth() === month && eDate.getDate() === d;
    });
    cells.push({ day: d, events: dayEvents });
  }
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push({ day: null, events: [] });

  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  function eventChipStyle(evt: EventWithCount, isSelected: boolean): React.CSSProperties {
    if (isSelected) {
      return { background: 'var(--orange)', color: 'var(--void)', border: '1px solid var(--orange)' };
    }
    if (evt.event_type === 'fnm') {
      return { background: 'var(--orange-mute)', color: 'var(--orange)', border: '1px solid var(--orange)' };
    }
    if (evt.event_type === 'prerelease') {
      return { background: 'var(--yellow-mute)', color: 'var(--yellow)', border: '1px solid var(--yellow)' };
    }
    if (evt.event_type === 'tournament') {
      return { background: 'var(--red-mute)', color: 'var(--red)', border: '1px solid var(--red)' };
    }
    return { background: 'var(--panel)', color: 'var(--ink-soft)', border: '1px solid var(--rule)' };
  }

  return (
    <div className="overflow-hidden" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--slate)' }}>
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="text-ink-soft hover:text-ink text-lg px-2"
          style={{ minHeight: 'auto' }}
          aria-label="Previous month"
        >
          ◀
        </button>
        <h3 className="font-display text-ink" style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.005em' }}>{monthName}</h3>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="text-ink-soft hover:text-ink text-lg px-2"
          style={{ minHeight: 'auto' }}
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--slate)' }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center font-mono uppercase text-ink-faint py-1.5" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="p-1"
            style={{
              minHeight: 80,
              borderBottom: '1px solid var(--rule-faint)',
              borderRight: '1px solid var(--rule-faint)',
              background: cell.day === null ? 'var(--panel)' : isToday(cell.day) ? 'var(--orange-mute)' : 'transparent',
            }}
          >
            {cell.day && (
              <>
                <div
                  className="font-mono mb-0.5 tabular-nums"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: isToday(cell.day) ? 700 : 500,
                    color: isToday(cell.day) ? 'var(--orange)' : 'var(--ink-soft)',
                  }}
                >
                  {cell.day}
                </div>
                <div className="space-y-0.5">
                  {cell.events.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => onEventClick(evt.id)}
                      className="w-full text-left px-1 py-0.5 truncate transition-colors font-mono"
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        minHeight: 'auto',
                        ...eventChipStyle(evt, expandedId === evt.id),
                      }}
                      title={`${evt.name} — ${new Date(evt.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                    >
                      {evt.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
