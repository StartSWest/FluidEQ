import { useId } from 'react';
import { BRAND_MARK } from 'common/branding';

/**
 * The credit drawn in full, for 32px and up: the site's 3D coin
 * (`CreditCoin`) as one SVG — a struck disc with its edge under it, a
 * polished band, the deep field, the app icon's wave and the light on the
 * band. The Get credits dialog's pack piles are made of it (Ivan,
 * 2026-11-13: "this is good"). Below 32px its band and highlight blur into a
 * grey dot; `CoinGlyph` is the same coin drawn for that size. Its paints are
 * inline styles in the window's accent, so a parent that inks its glyphs in
 * one colour leaves the coin a coin.
 */
export default function CoinMedal({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const band = `coin-medal-band-${id}`;
  const edge = `coin-medal-edge-${id}`;
  const field = `coin-medal-field-${id}`;
  const wave = 0.2;
  const centre = 9.4;
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      // Inline, so a parent's `svg { stroke: currentColor }` (a button's, a
      // menu's) is not inherited by every disc of the coin.
      style={{ overflow: 'visible', stroke: 'none' }}
    >
      <defs>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: '#ffffff' }} />
          <stop offset="0.3" style={{ stopColor: 'var(--accent-light)' }} />
          <stop offset="0.7" style={{ stopColor: 'var(--accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--accent-light)' }} />
        </linearGradient>
        <linearGradient id={edge} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: 'color-mix(in srgb, var(--accent) 70%, #000)' }}
          />
          <stop
            offset="1"
            style={{ stopColor: 'color-mix(in srgb, var(--accent) 30%, #000)' }}
          />
        </linearGradient>
        <radialGradient id={field} cx="0.4" cy="0.35" r="0.75">
          <stop
            offset="0"
            style={{
              stopColor: 'color-mix(in srgb, var(--accent) 38%, #0e1b2a)',
            }}
          />
          <stop
            offset="1"
            style={{
              stopColor: 'color-mix(in srgb, var(--accent) 15%, #070c14)',
            }}
          />
        </radialGradient>
      </defs>
      {/* The edge, showing under the face: the coin's thickness. */}
      <circle cx="10" cy="11.1" r="8" style={{ fill: `url(#${edge})` }} />
      {/* The polished band, then the struck field inside it. */}
      <circle cx="10" cy={centre} r="8" style={{ fill: `url(#${band})` }} />
      <circle cx="10" cy={centre} r="6.1" style={{ fill: `url(#${field})` }} />
      <circle
        cx="10"
        cy={centre}
        r="6.1"
        style={{
          fill: 'none',
          stroke: 'color-mix(in srgb, var(--accent-light) 45%, transparent)',
          strokeWidth: 0.5,
        }}
      />
      <path
        d={BRAND_MARK.path}
        transform={`translate(${10 - 24 * wave} ${centre - 24 * wave}) scale(${wave})`}
        style={{
          fill: 'none',
          stroke: 'var(--accent-light)',
          strokeWidth: 5.2,
          strokeLinecap: 'round',
        }}
      />
      {/* Where the light catches the band. */}
      <ellipse
        cx="7"
        cy="5.4"
        rx="2.6"
        ry="1.3"
        transform="rotate(-30 7 5.4)"
        style={{ fill: '#ffffff', opacity: 0.45 }}
      />
    </svg>
  );
}
