'use client';

export default function LibraryError({ error }: { error: Error }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>Library Error</h1>
      <pre style={{ color: '#fca5a5', background: '#1f2937', padding: '1rem', borderRadius: '8px', overflow: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
        {error.message}
      </pre>
    </div>
  );
}
