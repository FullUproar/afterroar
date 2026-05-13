'use client';

import { useState } from 'react';

interface InviteRequest {
  id: string;
  email: string;
  displayName: string | null;
  whyInterested: string | null;
  consents: Record<string, boolean>;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  inviteCodeId: string | null;
}

interface InviteCode {
  id: string;
  code: string;
  batch: string | null;
  maxUses: number;
  usedCount: number;
  notes: string | null;
  createdAt: string;
  expiresAt: string | null;
  consumedAt: string | null;
  consumedByEmail: string | null;
}

interface Props {
  requests: InviteRequest[];
  codes: InviteCode[];
  statusCounts: Record<string, number>;
  inviteGateEnabled: boolean;
}

export function InvitesClient({ requests, codes, statusCounts, inviteGateEnabled }: Props) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(0); // bump to re-render after action

  const filteredRequests = filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests;

  async function approve(req: InviteRequest, personalNote?: string) {
    setBusy(req.id);
    try {
      const res = await fetch(`/api/admin/invites/requests/${req.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || 'Approve failed');
        return;
      }
      alert(`Approved. Code: ${data.code}\nEmail dispatched (Resend).`);
      setRefreshed((n) => n + 1);
      // Reload page so server data is fresh.
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  async function reject(req: InviteRequest) {
    if (!confirm(`Reject ${req.email}? No email is sent on rejection.`)) return;
    setBusy(req.id);
    try {
      const res = await fetch(`/api/admin/invites/requests/${req.id}/approve?reject=true`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data?.error || 'Reject failed');
        return;
      }
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  async function mintBlankCode() {
    const batchInput = prompt('Batch tag (optional, e.g. "gencon-2026"):') || '';
    const maxUsesInput = prompt('Max uses (1 for single-use, higher for booth):', '1') || '1';
    const expiresInDaysInput = prompt('Expires in N days (blank = never):', '') || '';
    const notes = prompt('Notes (optional, internal only):') || '';

    const maxUses = Math.max(1, parseInt(maxUsesInput) || 1);
    const expiresInDays = expiresInDaysInput ? parseInt(expiresInDaysInput) : null;

    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch: batchInput.trim() || undefined,
        maxUses,
        expiresInDays,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || 'Mint failed');
      return;
    }
    alert(`Minted code: ${data.invite.code}\n\nLink:\nhttps://www.afterroar.me/signup?code=${data.invite.code}`);
    window.location.reload();
  }

  return (
    <div style={{ minHeight: '100vh', background: '#2a2f3a', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2.5rem 1.25rem 4rem' }}>
        <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#FF8200', fontWeight: 700, margin: 0 }}>
          Admin · Invites
        </p>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.3rem)', fontWeight: 900, color: '#FBDB65', margin: '0.45rem 0 0.5rem', lineHeight: 1.1 }}>
          Invite gate
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: '0 0 1.75rem' }}>
          Gate is <strong style={{ color: inviteGateEnabled ? '#10b981' : '#ef4444' }}>
            {inviteGateEnabled ? 'ON' : 'OFF'}
          </strong>{' '}
          (set INVITE_GATE_ENABLED env). Requests: pending {statusCounts.pending ?? 0} ·
          approved {statusCounts.approved ?? 0} · invited {statusCounts.invited ?? 0} · rejected {statusCounts.rejected ?? 0}.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            style={tabStyle(filter === 'pending')}
          >
            Pending ({statusCounts.pending ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={tabStyle(filter === 'all')}
          >
            All requests
          </button>
          <button
            type="button"
            onClick={mintBlankCode}
            style={{
              marginLeft: 'auto',
              padding: '0.55rem 1rem',
              background: '#FF8200',
              color: '#2a2f3a',
              border: 'none',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            + Mint code
          </button>
        </div>

        <h2 style={{ fontSize: '1rem', color: '#FBDB65', fontWeight: 700, margin: '0 0 0.75rem' }}>Requests</h2>
        {filteredRequests.length === 0 ? (
          <EmptyTable>No requests {filter === 'pending' ? 'pending' : 'yet'}.</EmptyTable>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
            {filteredRequests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                busy={busy === r.id}
                onApprove={(note) => approve(r, note)}
                onReject={() => reject(r)}
              />
            ))}
          </div>
        )}

        <h2 style={{ fontSize: '1rem', color: '#FBDB65', fontWeight: 700, margin: '2rem 0 0.75rem' }}>Recent codes</h2>
        {codes.length === 0 ? (
          <EmptyTable>No codes minted yet.</EmptyTable>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {codes.map((c) => (
              <CodeRow key={c.id} code={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.55rem 1rem',
    background: active ? '#FF8200' : 'transparent',
    border: '1px solid ' + (active ? '#FF8200' : '#2a2a4a'),
    borderRadius: 999,
    color: active ? '#2a2f3a' : '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function RequestCard({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: InviteRequest;
  busy: boolean;
  onApprove: (note?: string) => void;
  onReject: () => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const consentsList = Object.entries(request.consents)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: request.status === 'pending' ? 'rgba(255, 130, 0, 0.05)' : 'rgba(255, 255, 255, 0.025)',
        border: '1px solid ' + (request.status === 'pending' ? 'rgba(255, 130, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
        borderRadius: '0.55rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 18rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#FBDB65', fontWeight: 700, fontSize: '0.95rem' }}>
              {request.displayName || request.email.split('@')[0]}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{request.email}</span>
            <StatusBadge status={request.status} />
          </div>
          {request.whyInterested ? (
            <p
              style={{
                color: '#cbd5e1',
                fontSize: '0.83rem',
                marginTop: '0.45rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {request.whyInterested}
            </p>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.45rem', fontStyle: 'italic' }}>
              (no note left)
            </p>
          )}
          <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.45rem', fontFamily: 'monospace' }}>
            Consents: {consentsList.length} / 4 · Submitted {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        {request.status === 'pending' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 'min(100%, 14rem)' }}>
            {showNote ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional personal note for the email…"
                rows={3}
                style={{
                  padding: '0.5rem',
                  background: '#2a2f3a',
                  border: '1px solid #2a2a4a',
                  color: '#e2e8f0',
                  borderRadius: 4,
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  resize: 'vertical',
                }}
              />
            ) : null}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => (showNote ? onApprove(note.trim() || undefined) : setShowNote(true))}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.9rem',
                  background: '#10b981',
                  color: '#2a2f3a',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? '…' : showNote ? 'Send invite' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                style={{
                  padding: '0.55rem 0.9rem',
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CodeRow({ code }: { code: InviteCode }) {
  const url = `https://www.afterroar.me/signup?code=${encodeURIComponent(code.code)}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.65rem 0.85rem',
        background: 'rgba(255, 255, 255, 0.025)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.4rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        <code style={{ color: '#FF8200', fontWeight: 800, fontSize: '0.86rem' }}>{code.code}</code>
        <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
          {code.usedCount}/{code.maxUses} used
        </span>
        {code.batch ? <span style={{ color: '#64748b', fontSize: '0.7rem' }}>· {code.batch}</span> : null}
        {code.expiresAt ? (
          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>· expires {new Date(code.expiresAt).toLocaleDateString()}</span>
        ) : null}
        {code.consumedByEmail ? (
          <span style={{ color: '#10b981', fontSize: '0.7rem' }}>· used by {code.consumedByEmail}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(url).catch(() => {});
        }}
        style={{
          padding: '0.4rem 0.7rem',
          background: 'transparent',
          border: '1px solid #2a2a4a',
          color: '#94a3b8',
          borderRadius: 4,
          fontSize: '0.72rem',
          cursor: 'pointer',
        }}
      >
        Copy link
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
    approved: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
    invited: { bg: 'rgba(59, 130, 246, 0.15)', fg: '#3b82f6' },
    rejected: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
  };
  const c = colors[status] || { bg: 'rgba(107, 114, 128, 0.15)', fg: '#94a3b8' };
  return (
    <span
      style={{
        padding: '2px 7px',
        background: c.bg,
        color: c.fg,
        borderRadius: 3,
        fontSize: '0.62rem',
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: 'monospace',
      }}
    >
      {status}
    </span>
  );
}

function EmptyTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
      {children}
    </div>
  );
}
