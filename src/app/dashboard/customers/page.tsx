'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Customer, formatCents } from '@/lib/types';
import { StatusBadge } from '@/components/mobile-card';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/customers${q}`);
      if (res.ok) setCustomers(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timeout);
  }, [loadCustomers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', email: '', phone: '' });
        setShowForm(false);
        loadCustomers();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-2xl font-semibold text-foreground">Customers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm dark:shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-foreground text-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Adding...' : 'Add Customer'}
          </button>
        </form>
      )}

      <div>
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-input-bg border border-input-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="text-muted">Loading customers...</p>
      ) : customers.length === 0 ? (
        <p className="text-muted">No customers found.</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="block rounded-xl border border-card-border bg-card p-4 min-h-11 active:bg-card-hover shadow-sm dark:shadow-none transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground leading-snug">{c.name}</span>
                  <StatusBadge variant="success">
                    {formatCents(c.credit_balance_cents ?? 0)}
                  </StatusBadge>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {c.email || c.phone || 'No contact info'}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-card-border rounded-xl overflow-hidden shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Store Credit</th>
                  <th className="px-4 py-3 font-medium">Member Since</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/customers/${c.id}`}
                    className="contents"
                  >
                    <tr className="border-b border-card-border hover:bg-card-hover cursor-pointer text-foreground">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted">{c.email || '-'}</td>
                      <td className="px-4 py-3 text-muted">{c.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge variant="success">
                          {formatCents(c.credit_balance_cents ?? 0)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
