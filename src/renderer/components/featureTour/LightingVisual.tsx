/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * A desk taking Neon City's colours: keyboard, mouse on its pad, and a
 * headset hanging on its stand, one wave of colour travelling across all of
 * them the way Dynamic lighting sweeps a scene across real devices.
 *
 * Drawn, because the app's own desk preview needs a Windows machine with
 * lighting devices attached to show anything at all; the colours are the
 * scene's own.
 *
 * The gradient is laid out in the drawing's units, not each shape's, so a key
 * at the left edge and the headset at the right take different colours of
 * the same wave instead of each repeating the whole of it.
 */

const KEY = 16;
const PITCH = 19;

/** Four staggered rows and a bottom row round the space bar, 262 × 108. */
const KEYS = [
  ...[
    { y: 9, count: 12, x: 10 },
    { y: 28, count: 12, x: 18 },
    { y: 47, count: 11, x: 26 },
    { y: 66, count: 10, x: 34 },
  ].flatMap((row) =>
    Array.from({ length: row.count }, (_, index) => ({
      id: `${row.y}:${index}`,
      x: row.x + index * PITCH,
      y: row.y,
      width: KEY,
    })),
  ),
  ...[10, 29, 203, 222, 241].map((x) => ({
    id: `85:${x}`,
    x,
    y: 85,
    width: KEY,
  })),
  { id: 'space', x: 48, y: 85, width: 150 },
];

/**
 * The wave's stops, a sixth of a cycle apart: each one runs pink → violet →
 * cyan in turn, so together they read as colour moving across the desk.
 */
const STOPS = [0, 1, 2, 3, 4, 5, 6];

const EFFECTS: TranslationKey[] = [
  'lighting.effect.scene',
  'lighting.effect.flow',
  'lighting.effect.spectrum',
  'lighting.effect.pulse',
];

const WAVE = 'url(#lighting-visual-wave)';

export default function LightingVisual() {
  const { t } = useTranslation();
  return (
    <div className="lighting-visual">
      <svg
        className="lighting-visual__desk"
        viewBox="0 0 400 300"
        role="img"
        aria-label={t('tour.lighting.imageAlt')}
      >
        <defs>
          <linearGradient
            id="lighting-visual-wave"
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="400"
            y1="0"
            y2="0"
          >
            {STOPS.map((stop) => (
              <stop
                key={stop}
                className="lighting-visual__stop"
                offset={stop / (STOPS.length - 1)}
              />
            ))}
          </linearGradient>
          <filter
            id="lighting-visual-glow"
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* The light the devices throw on the desk. */}
        <g
          className="lighting-visual__spill"
          filter="url(#lighting-visual-glow)"
        >
          <rect x="18" y="22" width="364" height="150" rx="20" fill={WAVE} />
          <rect x="30" y="190" width="150" height="100" rx="16" fill={WAVE} />
          {/* Under the stand only: behind the headset it filled the band
              like a dome. */}
          <rect x="250" y="266" width="124" height="34" rx="17" fill={WAVE} />
        </g>

        {/* Keyboard. */}
        <g transform="translate(16 20) scale(1.405)">
          <rect
            className="lighting-visual__body"
            width="262"
            height="108"
            rx="12"
          />
          {KEYS.map((key) => (
            <rect
              key={key.id}
              className="lighting-visual__key"
              x={key.x}
              y={key.y}
              width={key.width}
              height={KEY}
              rx="3.5"
              fill={WAVE}
            />
          ))}
        </g>

        {/* Mouse on its pad. */}
        <rect
          className="lighting-visual__pad"
          x="22"
          y="186"
          width="166"
          height="104"
          rx="12"
        />
        <rect
          className="lighting-visual__rim"
          x="23.5"
          y="187.5"
          width="163"
          height="101"
          rx="11"
          stroke={WAVE}
        />
        {/* Lit round its edge; marks inside the shell read as a face. */}
        <path
          className="lighting-visual__body"
          d="M105 206c14 0 22 10 22 26v18c0 16-10 26-22 26s-22-10-22-26v-18c0-16 8-26 22-26Z"
        />
        <path
          className="lighting-visual__rim lighting-visual__rim--soft"
          d="M105 206c14 0 22 10 22 26v18c0 16-10 26-22 26s-22-10-22-26v-18c0-16 8-26 22-26Z"
          stroke={WAVE}
        />
        <path className="lighting-visual__seam" d="M105 207v24M84 232h42" />
        <rect
          className="lighting-visual__wheel"
          x="102"
          y="214"
          width="6"
          height="12"
          rx="3"
        />

        {/* Headset on its stand. */}
        <rect
          className="lighting-visual__body"
          x="262"
          y="282"
          width="100"
          height="10"
          rx="5"
        />
        <rect
          className="lighting-visual__strip"
          x="272"
          y="285"
          width="80"
          height="3"
          rx="1.5"
          fill={WAVE}
        />
        <rect
          className="lighting-visual__body"
          x="307"
          y="204"
          width="10"
          height="80"
          rx="3"
        />
        <rect
          className="lighting-visual__body"
          x="286"
          y="196"
          width="52"
          height="9"
          rx="4.5"
        />
        <path
          className="lighting-visual__band"
          d="M270 254C270 186 354 186 354 254"
        />
        <path
          className="lighting-visual__rim lighting-visual__rim--soft"
          d="M276 246C277 196 347 196 348 246"
          stroke={WAVE}
        />
        <rect
          className="lighting-visual__body"
          x="256"
          y="238"
          width="28"
          height="48"
          rx="11"
        />
        <rect
          className="lighting-visual__body"
          x="340"
          y="238"
          width="28"
          height="48"
          rx="11"
        />
        <rect
          className="lighting-visual__rim"
          x="260"
          y="244"
          width="20"
          height="36"
          rx="8"
          stroke={WAVE}
        />
        <rect
          className="lighting-visual__rim"
          x="344"
          y="244"
          width="20"
          height="36"
          rx="8"
          stroke={WAVE}
        />
      </svg>

      <ul className="lighting-visual__effects">
        {EFFECTS.map((effect) => (
          <li key={effect}>{t(effect)}</li>
        ))}
      </ul>
      <p className="lighting-visual__routes">
        {t('lighting.route.windows')} · {t('lighting.route.synapse')}
      </p>
    </div>
  );
}
