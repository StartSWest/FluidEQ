/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TLightingKind } from 'common/lighting/lightingModel';

/**
 * A device kind's small picture, drawn like the Plus rail's glyphs: a 20-unit
 * grid, stroked in `currentColor`, so a row lit or muted takes it along.
 */
export default function LightingKindGlyph({ kind }: { kind: TLightingKind }) {
  const shape = (() => {
    switch (kind) {
      case 'keyboard':
        return (
          <>
            <rect x="2" y="6" width="16" height="9" rx="2" />
            <path d="M5 9h1M8 9h1M11 9h1M14 9h1M5 12h10" />
          </>
        );
      case 'mouse':
        return (
          <>
            <rect x="6" y="2.5" width="8" height="15" rx="4" />
            <path d="M10 5.5v3" />
          </>
        );
      case 'mousepad':
        return (
          <>
            <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
            <rect x="9.5" y="7" width="4" height="6" rx="2" opacity="0.6" />
          </>
        );
      case 'headset':
        return (
          <>
            <path d="M4 12V9a6 6 0 0 1 12 0v3" />
            <rect x="3" y="11" width="3.5" height="5.5" rx="1.3" />
            <rect x="13.5" y="11" width="3.5" height="5.5" rx="1.3" />
          </>
        );
      case 'keypad':
        return (
          <>
            <rect x="4" y="3" width="12" height="14" rx="2" />
            <path d="M7 7h1M10 7h1M13 7h0M7 10h1M10 10h1M7 13h6" />
          </>
        );
      case 'stand':
        return (
          <>
            <path d="M10 4v11M5 17h10" />
            <path d="M6.5 5a4.5 4.5 0 0 1 7 0" />
          </>
        );
      case 'speaker':
        return (
          <>
            <rect x="5.5" y="2.5" width="9" height="15" rx="2" />
            <circle cx="10" cy="12" r="2.5" />
            <path d="M10 6h0" />
          </>
        );
      default:
        return (
          <>
            <circle cx="10" cy="10" r="6.5" />
            <circle cx="10" cy="10" r="2.5" opacity="0.6" />
          </>
        );
    }
  })();
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
