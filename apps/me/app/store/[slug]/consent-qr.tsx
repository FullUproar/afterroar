'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Loader2, Copy, Check } from 'lucide-react';
import { CONNECT_SCOPES, SCOPE_META } from '@/lib/connect-scopes';

const SCOPES = CONNECT_SCOPES.map((id) => ({
  id,
  label: SCOPE_META[id].label,
  desc: SCOPE_META[id].description,
  defaultOn: SCOPE_META[id].defaultOn,
}));

export function ConsentQR({ entityId }: { entityId: string }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SCOPES.filter((s) => s.defaultOn).map((s) => s.id))
  );
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, result.url, {
      width: 240,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).catch(() => setError('Could not render QR code'));
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const expires = new Date(result.expiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [result]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/store/consent-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          scopes: Array.from(selected),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to generate');
      else setResult({ url: data.url, expiresAt: data.expiresAt });
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          padding: '1rem',
          background: '#ffffff',
          borderRadius: '12px',
          marginBottom: '1rem',
        }}>
          <canvas ref={canvasRef} />
        </div>
        <p style={{ color: '#FBDB65', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
          Show this to your customer
        </p>
        <p style={{ color: secondsLeft < 60 ? '#fca5a5' : '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          Expires in {mins}:{secs.toString().padStart(2, '0')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={handleCopy} style={btnSecondary}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button onClick={() => { setResult(null); setSecondsLeft(0); }} style={btnSecondary}>
            New request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        Pick what you&apos;re asking to access. Customer scans, signs in, approves.
      </p>
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
        {SCOPES.map((s) => {
          const on = selected.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: on ? 'rgba(255, 130, 0, 0.08)' : '#0a0a0a',
                border: `1px solid ${on ? '#FF8200' : '#374151'}`,
                borderRadius: '8px',
                color: '#e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '4px',
                background: on ? '#FF8200' : 'transparent',
                border: `2px solid ${on ? '#FF8200' : '#6b7280'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && <Check size={12} style={{ color: '#0a0a0a' }} strokeWidth={3} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{s.label}</p>
                <p style={{ margin: '0.1rem 0 0', color: '#9ca3af', fontSize: '0.75rem' }}>{s.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g., 'Loyalty signup at checkout')"
        maxLength={120}
        style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          background: '#0a0a0a',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#e2e8f0',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          outline: 'none',
        }}
      />
      <button
        onClick={handleGenerate}
        disabled={selected.size === 0 || generating}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: selected.size > 0 ? '#FF8200' : '#374151',
          border: 'none',
          borderRadius: '8px',
          color: selected.size > 0 ? '#0a0a0a' : '#6b7280',
          fontWeight: 800,
          fontSize: '0.9rem',
          cursor: selected.size > 0 && !generating ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <QrCode size={16} />}
        {generating ? 'Generating…' : 'Generate QR code'}
      </button>
      {error && (
        <p style={{ marginTop: '0.75rem', color: '#fca5a5', fontSize: '0.85rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 0.85rem',
  background: 'transparent',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '0.4rem',
};
