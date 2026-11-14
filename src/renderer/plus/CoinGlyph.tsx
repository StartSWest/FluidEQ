import { useId } from 'react';
import { BRAND_MARK } from 'common/branding';

// Where the face sits on the 20-unit grid, and how wide the wave across it
// is drawn: the wave fills the field edge to edge at 0.235 of its 48 units.
const FACE_Y = 8.9;
const EDGE_Y = 11.1;
const FACE_R = 7.9;
const FIELD_R = 5.5;
const WAVE_SCALE = 0.235;
// 1.35 units of stroke once scaled: a 1px line at 15px, where the detailed
// coin's 1 unit went under a pixel and greyed out.
const WAVE_STROKE = 1.35 / WAVE_SCALE;

/**
 * The credit at glyph size, 13-24px: the same 3D coin as `CoinMedal` and
 * `CreditCoin` — the rim, the edge under it that reads as its tilt, the
 * deep field and the app icon's wave — drawn again for the size rather than
 * shrunk (Ivan, 2026-11-14: "we need to make an icon for those cases that
 * looks exactly the same but clean"). Shrunk, the detailed coin's polished
 * band, its highlight and its hairline ring blurred into a grey dot, and on
 * the loud button its accent face disappeared into the accent gradient
 * behind it.
 *
 * So: solid fills where the big one has gradients, a bolder wave, no
 * highlight, and a dark outline around the whole silhouette that parts the
 * coin from whatever it stands on — the accent gradient of a loud button, a
 * quiet dark row, the light floor of a light window. Its paints are inline
 * styles in the window's accent, so a parent that inks its glyphs in one
 * colour leaves the coin a coin.
 */
export default function CoinGlyph({ className }: { className?: string }) {
  const face = `coin-face-${useId().replace(/:/g, '')}`;
  const offset = 10 - 24 * WAVE_SCALE;
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
        <linearGradient id={face} x1="0" y1="0" x2="0.35" y2="1">
          <stop
            offset="0"
            style={{
              stopColor: 'color-mix(in srgb, var(--accent-light) 60%, #fff)',
            }}
          />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} />
        </linearGradient>
      </defs>
      {/* The outline: the silhouette of face and edge, 1.3 units wider. */}
      <g
        style={{
          fill: 'color-mix(in srgb, var(--accent) 22%, #03070c)',
        }}
      >
        <circle cx="10" cy={FACE_Y} r={FACE_R + 1.3} />
        <circle cx="10" cy={EDGE_Y} r={FACE_R + 1.3} />
      </g>
      {/* The edge under the face: the coin's thickness. */}
      <circle
        cx="10"
        cy={EDGE_Y}
        r={FACE_R}
        style={{ fill: 'color-mix(in srgb, var(--accent) 52%, #000)' }}
      />
      {/* The rim, then the struck field inside it. */}
      <circle
        cx="10"
        cy={FACE_Y}
        r={FACE_R}
        style={{ fill: `url(#${face})` }}
      />
      <circle
        cx="10"
        cy={FACE_Y}
        r={FIELD_R}
        style={{ fill: 'color-mix(in srgb, var(--accent) 20%, #050b12)' }}
      />
      <path
        d={BRAND_MARK.path}
        transform={`translate(${offset} ${FACE_Y - 24 * WAVE_SCALE}) scale(${WAVE_SCALE})`}
        style={{
          fill: 'none',
          stroke: 'color-mix(in srgb, var(--accent-light) 70%, #fff)',
          strokeWidth: WAVE_STROKE,
          strokeLinecap: 'round',
        }}
      />
    </svg>
  );
}
