'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Share2, Check } from 'lucide-react';
import { TitleBar, SecHero, Button, Chip, EmptyState, TYPE, SpinnerInline, inputStyle } from '@/app/components/ui';

interface WishlistItem {
  id: string;
  gameTitle: string;
  bggId?: number;
  priority: number;
  notes?: string;
  addedAt: string;
}

const PRIORITY: Record<number, { label: string; tone: 'red' | 'orange' | 'blue' | 'neutral' }> = {
  1: { label: 'Must have', tone: 'red' },
  2: { label: 'Want', tone: 'orange' },
  3: { label: 'Interested', tone: 'blue' },
  4: { label: 'Maybe someday', tone: 'neutral' },
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ gameTitle: '', priority: 3, notes: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchWishlist = async () => {
    const res = await fetch('/api/wishlist');
    if (res.ok) { const data = await res.json(); setItems(data.items); }
    setLoading(false);
  };

  useEffect(() => { fetchWishlist(); }, []);

  const handleAdd = async () => {
    if (!form.gameTitle.trim()) return;
    setSaving(true);
    await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ gameTitle: '', priority: 3, notes: '' });
    setShowForm(false);
    setSaving(false);
    fetchWishlist();
  };

  const handleRemove = async (id: string) => {
    await fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' });
    fetchWishlist();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/wishlist/share`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <>
      <TitleBar left="Wishlist" right={`${items.length} ${items.length === 1 ? 'title' : 'titles'}`} />
      <SecHero
        fieldNum="02"
        fieldType="Desires"
        title="Wishlist"
        count={loading ? '—' : `${items.length} ${items.length === 1 ? 'title' : 'titles'}`}
        desc="Games you want. Share this list with family for gift ideas, or let stores see it when you scan your Passport."
        actions={
          <>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus size={15} /> Add game
            </Button>
            {items.length > 0 ? (
              <Button variant="ghost" onClick={handleShare}>
                {copied ? <><Check size={14} /> Copied</> : <><Share2 size={14} /> Share</>}
              </Button>
            ) : null}
          </>
        }
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body }}>
        {/* Add form */}
        {showForm ? (
          <div style={{ background: 'var(--panel-mute)', border: '2px solid var(--orange)', padding: '1rem', marginBottom: '1.25rem' }}>
            <input
              placeholder="Game title"
              value={form.gameTitle}
              onChange={(e) => setForm({ ...form, gameTitle: e.target.value })}
              autoFocus
              style={{ ...inputStyle(), marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              {Object.entries(PRIORITY).map(([val, { label, tone }]) => {
                const isOn = form.priority === Number(val);
                return (
                  <button key={val} onClick={() => setForm({ ...form, priority: Number(val) })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <Chip tone={tone} on={isOn}>{label}</Chip>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button onClick={handleAdd} disabled={!form.gameTitle.trim() || saving}>
                {saving ? 'Adding…' : 'Add to wishlist'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <SpinnerInline /> Loading…
          </p>
        ) : items.length === 0 ? (
          <EmptyState title="Your wishlist is empty" desc="Add games you want — share the list with family or let stores see it at checkout." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
            {items.map((item) => {
              const pri = PRIORITY[item.priority] || PRIORITY[3];
              return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'var(--panel-mute)',
                  gap: '0.75rem',
                  borderLeft: `2px solid var(--${pri.tone === 'red' ? 'red' : pri.tone === 'orange' ? 'orange' : pri.tone === 'blue' ? 'blue' : 'ink-faint'})`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ ...TYPE.displayMd, color: 'var(--cream)', fontSize: '0.95rem' }}>{item.gameTitle}</span>
                      <Chip tone={pri.tone}>{pri.label}</Chip>
                    </div>
                    {item.notes ? (
                      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>{item.notes}</p>
                    ) : null}
                  </div>
                  <button onClick={() => handleRemove(item.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--ink-faint)',
                  }}><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 ? (
          <p style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.68rem', margin: '0.75rem 0 0', textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {items.length} {items.length === 1 ? 'title' : 'titles'} on your wishlist
          </p>
        ) : null}
      </div>
    </>
  );
}
