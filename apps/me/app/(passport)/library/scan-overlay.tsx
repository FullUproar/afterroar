'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface BoundedGame {
  title: string;
  confidence: 'high' | 'medium' | 'low';
  bounds?: [number, number, number, number];
  rawGuess: string;
  bggRating?: number | null;
}

interface UnidentifiedRegion {
  bounds: [number, number, number, number];
  description: string;
}

const CONFIDENCE_COLORS = {
  high: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Identified' },
  medium: { border: '#FF8200', bg: 'rgba(255, 130, 0, 0.15)', label: 'Likely' },
  low: { border: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', label: 'Unverified' },
};

const UNIDENTIFIED_STYLE = { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };

export function ScanOverlay({
  imageDataUrl,
  games,
  unidentifiedRegions,
}: {
  imageDataUrl: string;
  games: BoundedGame[];
  unidentifiedRegions: UnidentifiedRegion[];
}) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showUnidentified, setShowUnidentified] = useState(true);

  const gamesWithBounds = games.filter((g) => g.bounds && g.bounds.some((v) => v > 0));
  const hasAnyBounds = gamesWithBounds.length > 0 || unidentifiedRegions.length > 0;

  if (!hasAnyBounds) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowOverlay(!showOverlay)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.4rem 0.75rem',
            background: showOverlay ? 'rgba(255, 130, 0, 0.1)' : '#1f2937',
            border: `1px solid ${showOverlay ? '#FF8200' : '#374151'}`,
            borderRadius: '6px',
            color: showOverlay ? '#FF8200' : '#6b7280',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
          {showOverlay ? 'Overlay on' : 'Overlay off'}
        </button>

        {showOverlay && unidentifiedRegions.length > 0 && (
          <button
            onClick={() => setShowUnidentified(!showUnidentified)}
            style={{
              padding: '0.4rem 0.75rem',
              background: showUnidentified ? 'rgba(239, 68, 68, 0.1)' : '#1f2937',
              border: `1px solid ${showUnidentified ? '#ef4444' : '#374151'}`,
              borderRadius: '6px',
              color: showUnidentified ? '#ef4444' : '#6b7280',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {showUnidentified ? 'Hide' : 'Show'} unidentified ({unidentifiedRegions.length})
          </button>
        )}

        {/* Legend */}
        {showOverlay && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: 'auto' }}>
            {Object.entries(CONFIDENCE_COLORS).map(([key, val]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#6b7280' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: val.bg, border: `2px solid ${val.border}` }} />
                {val.label}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: UNIDENTIFIED_STYLE.bg, border: `2px dashed ${UNIDENTIFIED_STYLE.border}` }} />
              Unknown
            </span>
          </div>
        )}
      </div>

      {/* Image with overlay */}
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', lineHeight: 0 }}>
        <img
          src={imageDataUrl}
          alt="Scanned shelf"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />

        {showOverlay && (
          <>
            {/* Identified games */}
            {gamesWithBounds.map((game, i) => {
              const [x1, y1, x2, y2] = game.bounds!;
              const colors = CONFIDENCE_COLORS[game.confidence];
              const isHovered = hoveredIndex === i;

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    position: 'absolute',
                    left: `${x1}%`, top: `${y1}%`,
                    width: `${x2 - x1}%`, height: `${y2 - y1}%`,
                    border: `2px solid ${colors.border}`,
                    background: isHovered ? colors.bg : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    zIndex: isHovered ? 20 : 10,
                  }}
                >
                  {/* Hover tooltip */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      marginBottom: '4px',
                      padding: '6px 10px',
                      background: '#0a0a0a',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      zIndex: 30,
                      pointerEvents: 'none',
                    }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>
                        {game.title}
                      </div>
                      {game.rawGuess !== game.title && (
                        <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                          Detected: &quot;{game.rawGuess}&quot;
                        </div>
                      )}
                      {game.bggRating && (
                        <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                          BGG: {game.bggRating}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unidentified regions */}
            {showUnidentified && unidentifiedRegions.map((region, i) => {
              const [x1, y1, x2, y2] = region.bounds;
              return (
                <div
                  key={`u-${i}`}
                  title={region.description}
                  style={{
                    position: 'absolute',
                    left: `${x1}%`, top: `${y1}%`,
                    width: `${x2 - x1}%`, height: `${y2 - y1}%`,
                    border: `2px dashed ${UNIDENTIFIED_STYLE.border}`,
                    background: UNIDENTIFIED_STYLE.bg,
                    zIndex: 5,
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
