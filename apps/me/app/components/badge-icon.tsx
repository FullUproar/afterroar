/**
 * Renders a badge icon. Prefers the custom iconUrl PNG; falls back to emoji
 * (for older badges or anything still using emoji), then a generic medal.
 *
 * Server component — no client JS needed.
 */

interface BadgeIconProps {
  iconUrl?: string | null;
  iconEmoji?: string | null;
  name: string;
  size?: number;
  glowColor?: string;
}

export function BadgeIcon({ iconUrl, iconEmoji, name, size = 48, glowColor }: BadgeIconProps) {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={`${name} badge`}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          filter: glowColor ? `drop-shadow(0 0 12px ${glowColor}66)` : undefined,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-label={`${name} badge`}
      style={{
        fontSize: size * 0.7,
        lineHeight: 1,
        flexShrink: 0,
        filter: glowColor ? `drop-shadow(0 0 12px ${glowColor}66)` : undefined,
      }}
    >
      {iconEmoji || '🏅'}
    </span>
  );
}
