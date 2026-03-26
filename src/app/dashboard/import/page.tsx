'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ImportJob {
  id: string;
  source_system: string;
  entity_type: string;
  status: string;
  file_name: string;
  row_count: number;
  created_at: string;
  committed_at: string | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  mapping: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  validated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  previewing: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ImportPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/import')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load imports');
        return res.json();
      })
      .then((data) => setJobs(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-2xl font-bold text-white">Data Import</h1>
        <Link
          href="/dashboard/import/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          New Import
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-zinc-400">Loading imports...</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          <p className="text-lg font-medium">No imports yet</p>
          <p className="mt-2 text-sm">
            Import your inventory and customers from another POS system.
            We support BinderPOS, Square, Lightspeed, Shopify, SortSwift, ShadowPOS, and generic CSV.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium text-right">Rows</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {jobs.map((job) => (
                <tr key={job.id} className="text-white hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-300">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 capitalize">{job.source_system}</td>
                  <td className="px-4 py-3 capitalize">{job.entity_type}</td>
                  <td className="px-4 py-3 text-zinc-300">{job.file_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{job.row_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[job.status] ?? ''}`}
                    >
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
