'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, AlertCircle } from 'lucide-react';
import { TitleBar, SecHero, Button, Chip, EmptyState, TYPE, SpinnerInline, inputStyle } from '@/app/components/ui';

interface Loan {
  id: string;
  gameTitle: string;
  borrowerName: string;
  borrowerContact?: string;
  lentAt: string;
  dueDate?: string;
  returnedAt?: string;
  condition?: string;
  notes?: string;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<{ active: Loan[]; returned: Loan[] }>({ active: [], returned: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ gameTitle: '', borrowerName: '', borrowerContact: '', dueDate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchLoans = async () => {
    const res = await fetch('/api/loans');
    if (res.ok) setLoans(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLoans(); }, []);

  const handleLend = async () => {
    if (!form.gameTitle.trim() || !form.borrowerName.trim()) return;
    setSaving(true);
    await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ gameTitle: '', borrowerName: '', borrowerContact: '', dueDate: '', notes: '' });
    setShowForm(false);
    setSaving(false);
    fetchLoans();
  };

  const handleReturn = async (id: string) => {
    await fetch('/api/loans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchLoans();
  };

  const daysSince = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  const isOverdue = (loan: Loan) => loan.dueDate && !loan.returnedAt && new Date(loan.dueDate) < new Date();

  return (
    <>
      <TitleBar left="Loans" right={`${loans.active.length} active`} />
      <SecHero
        fieldNum="03"
        fieldType="In Transit"
        title="Loans"
        desc="Track who has your games and when they're coming back."
        actions={<Button onClick={() => setShowForm(!showForm)}><Plus size={15} /> Lend a game</Button>}
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body }}>
        {showForm ? (
          <div style={{ background: 'var(--panel-mute)', border: '2px solid var(--orange)', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <input placeholder="Game title" value={form.gameTitle} onChange={(e) => setForm({ ...form, gameTitle: e.target.value })} style={inputStyle()} />
              <input placeholder="Borrower name" value={form.borrowerName} onChange={(e) => setForm({ ...form, borrowerName: e.target.value })} style={inputStyle()} />
              <input placeholder="Contact (email/phone)" value={form.borrowerContact} onChange={(e) => setForm({ ...form, borrowerContact: e.target.value })} style={inputStyle()} />
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inputStyle()} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button onClick={handleLend} disabled={!form.gameTitle.trim() || !form.borrowerName.trim() || saving}>
                {saving ? 'Saving…' : 'Record loan'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <SpinnerInline /> Loading…
          </p>
        ) : (
          <>
            <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.6rem' }}>
              Currently out ({loans.active.length})
            </h2>
            {loans.active.length === 0 ? (
              <EmptyState
                title="Nothing out on loan"
                desc="Track who has what. When a friend borrows Pandemic, log it here — Passport remembers, so you don't have to ask 'wait, did I give you that?' six months later."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: '1.5rem' }}>
                {loans.active.map((loan) => {
                  const overdue = isOverdue(loan);
                  return (
                    <div key={loan.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: 'var(--panel-mute)',
                      gap: '0.75rem',
                      borderLeft: overdue ? '2px solid var(--red)' : '2px solid var(--rule)',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ ...TYPE.displayMd, color: 'var(--cream)', fontSize: '0.95rem' }}>{loan.gameTitle}</span>
                          {overdue ? <Chip tone="red"><AlertCircle size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />Overdue</Chip> : null}
                        </div>
                        <div style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.72rem', marginTop: '0.2rem', letterSpacing: '0.04em' }}>
                          → {loan.borrowerName} · {daysSince(loan.lentAt)} days ago
                          {loan.dueDate ? ` · Due ${new Date(loan.dueDate).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleReturn(loan.id)}>
                        <Check size={13} /> Returned
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {loans.returned.length > 0 ? (
              <>
                <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '1.5rem 0 0.6rem' }}>
                  History ({loans.returned.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
                  {loans.returned.slice(0, 20).map((loan) => (
                    <div key={loan.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.7rem 1rem',
                      background: 'var(--panel-mute)',
                      opacity: 0.7,
                      gap: '0.5rem',
                    }}>
                      <span style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.85rem' }}>
                        {loan.gameTitle} → {loan.borrowerName}
                      </span>
                      <span style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                        {daysSince(loan.lentAt)}d · returned {new Date(loan.returnedAt!).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
