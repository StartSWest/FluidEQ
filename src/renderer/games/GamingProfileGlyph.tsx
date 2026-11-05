/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGamingProfileGlyph } from './gamingProfileFacts';

/**
 * A kind of game, drawn: a sight for the shooters, the closing circle of a
 * battle royale, a compass for tactical survival, a ghost for story and
 * horror, headphones for the Room around you, a lane map for top-down, a
 * globe for worlds, a dial for speed, a burst for impact, and a star for the
 * listener's own. Strokes on the 24-unit grid the app's menu icons use.
 */
const PATHS: Record<TGamingProfileGlyph, string> = {
  competitive:
    'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M12 11v2',
  battle:
    'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM14.5 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM14.5 12.5h0',
  tactical:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM14.8 9.2l-1.6 4-4 1.6 1.6-4zM12 4v1.6M12 18.4V20M4 12h1.6M18.4 12H20',
  story:
    'M6 19.5V10.5a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10 10.5h0M14 10.5h0',
  room: 'M5 14.5v-2a7 7 0 0 1 14 0v2M4 14h3v5.5H5.5A1.5 1.5 0 0 1 4 18zM20 14h-3v5.5h1.5A1.5 1.5 0 0 0 20 18z',
  topDown:
    'M4.5 4.5h15v15h-15zM4.5 19.5l15-15M4.5 12c3.5 0 4-3.5 7.5-3.5M12 15.5c3.5 0 4-3.5 7.5-3.5',
  worlds:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 12h16M12 4c-2.5 2.2-3.5 5-3.5 8s1 5.8 3.5 8M12 4c2.5 2.2 3.5 5 3.5 8s-1 5.8-3.5 8',
  speed: 'M4.5 16a7.5 7.5 0 1 1 15 0M12 16l4-5.5M7 16h0M17 16h0M12 8.5v1.5',
  impact:
    'M12 3.5l1.6 4.6 4.6-1.6-1.6 4.6 4.6 1.6-4.6 1.6 1.6 4.6-4.6-1.6-1.6 4.6-1.6-4.6-4.6 1.6 1.6-4.6-4.6-1.6 4.6-1.6-1.6-4.6 4.6 1.6z',
  yours:
    'M12 4l2.3 4.7 5.2.8-3.75 3.65.9 5.15L12 15.9l-4.65 2.4.9-5.15L4.5 9.5l5.2-.8L12 4z',
};

const GamingProfileGlyph = ({ glyph }: { glyph: TGamingProfileGlyph }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[glyph]} />
  </svg>
);

export default GamingProfileGlyph;
