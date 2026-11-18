/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TWindowTime } from '../utils/sceneDayColours';

/**
 * A crescent for the night and a sun for the day, in the line weight of the
 * app's own glyphs: the window colour editors' two times, and the two ends
 * of the Studio's Brightness that carries the scene from one to the other.
 * Drawn in `currentColor` by whoever places it.
 */
export default function WindowTimeGlyph({ time }: { time: TWindowTime }) {
  return time === 'night' ? (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M10.6 2.2a6 6 0 1 0 3.2 9.6A5 5 0 0 1 10.6 2.2Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
    </svg>
  );
}
