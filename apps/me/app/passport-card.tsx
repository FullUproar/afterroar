'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function PassportCard({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, code, {
      width: 240,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch((err) => console.error('[passport-card] QR render failed', err));
  }, [code]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.9rem',
      padding: '1.1rem',
      background: 'var(--panel)',
      border: '1px dashed var(--orange)',
      width: '100%',
      maxWidth: '20rem',
      position: 'relative',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono), ui-monospace, Menlo, monospace',
        color: 'var(--orange)',
        fontSize: '0.62rem',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.25em',
        fontWeight: 700,
      }}>
        Show this at the counter
      </p>

      <div style={{ padding: '0.75rem', background: '#ffffff' }}>
        <canvas ref={canvasRef} aria-label={`QR code for Passport ${code}`} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-mono), ui-monospace, Menlo, monospace',
          color: 'var(--yellow)',
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '0.2em',
          margin: 0,
        }}>
          {code}
        </p>
        <p style={{
          fontFamily: 'var(--font-body), system-ui, sans-serif',
          color: 'var(--ink-faint)',
          fontSize: '0.72rem',
          margin: '0.35rem 0 0',
          fontStyle: 'italic',
        }}>
          Or read this code out loud
        </p>
      </div>
    </div>
  );
}
