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
      gap: '1rem',
      padding: '1.5rem',
      background: '#1f2937',
      border: '2px solid rgba(255, 130, 0, 0.3)',
      borderRadius: '16px',
      width: '100%',
      maxWidth: '20rem',
    }}>
      <p style={{
        color: '#9ca3af',
        fontSize: '0.7rem',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        fontWeight: 700,
      }}>
        Show this at the counter
      </p>

      <div style={{
        padding: '0.75rem',
        background: '#ffffff',
        borderRadius: '10px',
      }}>
        <canvas ref={canvasRef} aria-label={`QR code for Passport ${code}`} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{
          color: '#FBDB65',
          fontSize: '1.5rem',
          fontWeight: 900,
          letterSpacing: '0.2em',
          margin: 0,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {code}
        </p>
        <p style={{
          color: '#6b7280',
          fontSize: '0.7rem',
          margin: '0.35rem 0 0',
        }}>
          Or read this code out loud
        </p>
      </div>
    </div>
  );
}
