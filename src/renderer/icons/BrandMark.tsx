/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useId, type CSSProperties } from 'react';
import { BRAND_MARK } from 'common/branding';
import { LAGOON } from '../utils/rainbowPalette';

interface IBrandMarkProps {
  /** Extra class on the tile, for a panel that wants a different size. */
  className?: string;
}

/**
 * The app icon's wave colours, first stop to last, for a mark's `<defs>`:
 * Lagoon, never the palette in use, which a Plus visualizer changes.
 */
export function LagoonWaveGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {LAGOON.map((colour, index) => (
        <stop
          key={colour}
          offset={index / (LAGOON.length - 1)}
          stopColor={colour}
        />
      ))}
    </linearGradient>
  );
}

/**
 * The window's colours along the wave, for the header's mark: five stops that
 * read `--logo-1` to `--logo-5`, which the header sets from the accent in
 * Normal and from the palette in use in Rainbow (`SignalBrand.scss`). Stop
 * colours are CSS properties, so they follow a theme or a visualizer's
 * colours as they change, with nothing re-rendered.
 */
const THEME_WAVE_STOPS = [1, 2, 3, 4, 5] as const;

export function ThemeWaveGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {THEME_WAVE_STOPS.map((stop, index) => (
        <stop
          key={stop}
          offset={index / (THEME_WAVE_STOPS.length - 1)}
          style={{ stopColor: `var(--logo-${stop})` }}
        />
      ))}
    </linearGradient>
  );
}

/**
 * The gradient's id, of this mark's own, and the property `.brand-mark path`
 * strokes with (`App.scss`). Several marks can be on screen at once, and
 * `useId`'s colons are taken out, or the `url()` would have to escape them.
 */
export const useLagoonWave = () => {
  const id = `brand-wave-${useId().replace(/:/g, '')}`;
  return {
    id,
    style: { '--brand-wave-paint': `url(#${id})` } as CSSProperties,
  };
};

/**
 * The logo, wherever the app shows itself: the app icon, its tile and its
 * wave in Lagoon (`App.scss`).
 *
 * The tile comes with it rather than being left to each caller: `.brand-mark`
 * is what styles the frame AND the stroke inside it, so a bare `<svg>` handed
 * to a different parent draws an invisible path. Always decorative — every
 * place this appears has the product name in text beside it, so announcing the
 * glyph as well would read the name twice.
 */
export default function BrandMark({ className }: IBrandMarkProps) {
  const wave = useLagoonWave();
  return (
    <div
      className={className ? `brand-mark ${className}` : 'brand-mark'}
      aria-hidden="true"
      style={wave.style}
    >
      <svg viewBox={BRAND_MARK.viewBox}>
        <defs>
          <LagoonWaveGradient id={wave.id} />
        </defs>
        <path d={BRAND_MARK.path} />
      </svg>
    </div>
  );
}
