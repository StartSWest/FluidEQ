/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import { BRAND_MARK } from 'common/branding';
import { RAINBOW_TOKENS } from '../utils/rainbowPalette';
import '../styles/SignalBrand.scss';

/**
 * The logo in the header, alive: "Signal" (Ivan chose it on 2026-09-25 from
 * four, https://claude.ai/artifact/HZpBeQQa79QDb2KAKjNvkV). At launch the
 * wave draws itself; after that a pulse of light runs along it every few
 * seconds, and the name's "EQ" glows as it arrives (`SignalBrandName`). In
 * Rainbow mode the tile keeps its dark face, its edge takes the mode's
 * palette, drifting as the name's does, and the wave is drawn in the palette
 * from end to end. Still when motion is turned
 * down (`SignalBrand.scss`).
 *
 * The tile is `.brand-mark`'s, so every size the header gives the mark still
 * applies. Everywhere else the app shows itself the logo stays the still one
 * (`BrandMark`): this is the header's.
 *
 * `pathLength` makes the wave sixty units long whatever its geometry, which is
 * what the draw and the pulse are timed against.
 */
export default function SignalBrandMark() {
  // The wave's gradient, by an id of this mark's own: the header and the
  // Compact player can both draw one. `useId`'s colons are taken out, or the
  // `url()` that paints with it would have to escape them.
  const gradient = `signal-wave-${useId().replace(/:/g, '')}`;
  return (
    <div
      className="brand-mark brand-mark--signal"
      aria-hidden="true"
      style={{ '--signal-wave-paint': `url(#${gradient})` } as CSSProperties}
    >
      <svg viewBox={BRAND_MARK.viewBox}>
        {/* Rainbow mode's palette, first stop to last, read from the root
            (`Rainbow.scss`); only the mode strokes the wave with it. */}
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
            {RAINBOW_TOKENS.map((token, index) => (
              <stop
                key={token}
                offset={index / (RAINBOW_TOKENS.length - 1)}
                style={{ stopColor: `var(${token})` }}
              />
            ))}
          </linearGradient>
        </defs>
        <path
          className="brand-mark__wave"
          d={BRAND_MARK.path}
          pathLength={60}
        />
        <path
          className="brand-mark__pulse"
          d={BRAND_MARK.path}
          pathLength={60}
        />
      </svg>
    </div>
  );
}
