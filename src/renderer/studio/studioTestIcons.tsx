/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ReactElement } from 'react';
import type { TStudioSize } from './StudioStage';
import type { TStudioSignal } from './studioSignals';

/**
 * The Studio's test tiles draw what each choice is.
 *
 * The three bands are one wave at three speeds — one cycle for the bass, two
 * for the mids, four for the treble — so the row reads low to high before its
 * names are read. Silence is a muted speaker, the beat a pulse, the accent a
 * spark, the simulated mix a mixer's faders; the sizes are the shape of the
 * stage each one gives.
 * Strokes on a 16px grid, drawn in the tile's own ink.
 */

const Svg = ({ children }: { children: ReactElement | ReactElement[] }) => (
  <svg viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

export const SIGNAL_ICONS: Record<TStudioSignal, ReactElement> = {
  live: (
    <Svg>
      <path d="M6 11.6V3.9l7-1.6v7.8" />
      <circle cx="4.2" cy="11.6" r="1.8" />
      <circle cx="11.2" cy="10.1" r="1.8" />
    </Svg>
  ),
  silence: (
    <Svg>
      <path d="M2 6.2h2.4L8 3.3v9.4l-3.6-2.9H2z" />
      <path d="M10.6 6.2l3.4 3.6M14 6.2l-3.4 3.6" />
    </Svg>
  ),
  bass: (
    <Svg>
      <path d="M1.5 8c1.63-6 4.87-6 6.5 0s4.87 6 6.5 0" />
    </Svg>
  ),
  mid: (
    <Svg>
      <path d="M1.5 8c.81-5 2.44-5 3.25 0s2.44 5 3.25 0 2.44-5 3.25 0 2.44 5 3.25 0" />
    </Svg>
  ),
  treble: (
    <Svg>
      <path d="M1.5 8c.41-3.6 1.22-3.6 1.63 0s1.21 3.6 1.62 0 1.22-3.6 1.63 0 1.21 3.6 1.62 0 1.22-3.6 1.63 0 1.21 3.6 1.62 0 1.22-3.6 1.63 0 1.21 3.6 1.62 0" />
    </Svg>
  ),
  beat: (
    <Svg>
      <path d="M1.5 9h3.2l1.4-6.2 2.2 10.4 1.5-4.2h4.7" />
    </Svg>
  ),
  accent: (
    <Svg>
      <path d="M8 2.2l1.5 4.3 4.3 1.5-4.3 1.5L8 13.8l-1.5-4.3L2.2 8l4.3-1.5z" />
    </Svg>
  ),
  showcase: (
    <Svg>
      <path d="M3.5 2.5v11M8 2.5v11M12.5 2.5v11" />
      <path d="M2 10h3M6.5 5h3M11 8.5h3" />
    </Svg>
  ),
};

export const SIZE_ICONS: Record<TStudioSize, ReactElement> = {
  graph: (
    <Svg>
      <rect x="1.5" y="5.2" width="13" height="5.6" rx="1.2" />
    </Svg>
  ),
  narrow: (
    <Svg>
      <rect x="5" y="1.5" width="6" height="13" rx="1.2" />
    </Svg>
  ),
  wide: (
    <Svg>
      <rect x="1.8" y="3.9" width="12.4" height="8.2" rx="1.2" />
    </Svg>
  ),
  full: (
    <Svg>
      <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
    </Svg>
  ),
};
