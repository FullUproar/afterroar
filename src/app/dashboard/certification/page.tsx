'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store-context';

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn';
  details: string;
  count?: number;
}

interface CertResult {
  id: string;
  status: string;
  checks: CheckResult[];
  summary: { total: number; passed: number; failed: number; warnings: number } | null;
  completed_at: string | null;
}

const statusIcon: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  warn: '⚠',
};

const statusColor: Record<string, string> = {
  pass: 'text-green-400',
  fail: 'text-red-400',
  warn: 'text-yellow-400',
};

const categoryLabels: Record<string, string> = {
  isolation: 'Tenant Isolation',
  integrity: 'Data Integrity',
  completeness: 'Completeness',
  consistency: 'Consistency',
};

export default function CertificationPage() {
  const { can } = useStore();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CertResult | null>(null);
  const [error, setError] = useState('');

  if (!can('store.settings')) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to run certifications.</p>
      </div>
    );
  }

  async function runCertification() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/certification', { method: 'POST' });
      if (!res.ok) throw new Error('Certification failed');
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Certification failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hidden md:block text-2xl font-bold text-white">Data Certification</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Verify your store&apos;s data isolation, integrity, and consistency.
          </p>
        </div>
        <button
          onClick={runCertification}
          disabled={running}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running Checks...' : 'Run Certification'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Summary banner */}
          <div
            className={`rounded-lg border p-6 ${
              result.status === 'passed'
                ? 'border-green-500/30 bg-green-500/10'
                : result.status === 'failed'
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-yellow-500/30 bg-yellow-500/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-3xl ${
                  result.status === 'passed'
                    ? 'text-green-400'
                    : result.status === 'failed'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }`}
              >
                {result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '⚠'}
              </span>
              <div>
                <div className="text-lg font-bold text-white capitalize">
                  {result.status === 'passed'
                    ? 'All Checks Passed'
                    : result.status === 'failed'
                      ? 'Certification Failed'
                      : 'Passed with Warnings'}
                </div>
                {result.summary && (
                  <div className="text-sm text-zinc-300">
                    {result.summary.passed} passed · {result.summary.failed} failed ·{' '}
                    {result.summary.warnings} warnings
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Individual checks */}
          <div className="space-y-4">
            {['isolation', 'integrity', 'completeness', 'consistency'].map((category) => {
              const categoryChecks = result.checks.filter((c) => c.category === category);
              if (categoryChecks.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-medium text-zinc-400">
                    {categoryLabels[category] ?? category}
                  </h3>
                  <div className="space-y-2">
                    {categoryChecks.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                      >
                        <span className={`text-lg ${statusColor[check.status]}`}>
                          {statusIcon[check.status]}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-white">{check.name}</div>
                          <div className="text-sm text-zinc-400">{check.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!result && !running && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <p className="text-lg font-medium text-zinc-400">Ready to certify</p>
          <p className="mt-2 text-sm text-zinc-500">
            Run a certification to verify your data is isolated, complete, and consistent.
            This checks for cross-store data leaks, ledger balance integrity, and more.
          </p>
        </div>
      )}
    </div>
  );
}
