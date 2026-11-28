/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';

/**
 * Plus's emblem: FluidWallpapers' drawing — a rounded tile with a plus whose
 * crossbar ends in the wave's trough and crest — in FluidEQ's wordmark band,
 * from the accent's start through the accent to the purple of the active
 * state, so it follows the window's colours like the wordmark does.
 *
 * Decoration always: whatever it stands beside says "Plus" in words.
 */
export default function PlusMark({ className }: { className?: string }) {
  // Each emblem names its own band: an id shared across the page would be
  // the first one's, gone with it when that emblem unmounts. React's ids
  // carry characters a `url(#…)` reference does not take.
  const band = `plus-band-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      className={`plus-mark${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={band}
          gradientUnits="userSpaceOnUse"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
        >
          <stop offset="0" className="plus-mark__start" />
          <stop offset="0.5" className="plus-mark__middle" />
          <stop offset="1" className="plus-mark__end" />
        </linearGradient>
      </defs>
      <rect
        x="0.75"
        y="0.75"
        width="22.5"
        height="22.5"
        rx="7"
        fill={`url(#${band})`}
      />
      <path
        className="plus-mark__cross"
        d="M12 6.2v11.6M6.2 12.9c1.1-.9 2.1-.9 3.2-.9h5.2c1.1 0 2.1 0 3.2-.9"
      />
    </svg>
  );
}
