/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TDeviceForm } from 'common/lighting/deviceForms';

const keyboard = (
  <>
    <rect x="2" y="6" width="16" height="9" rx="2" />
    <path d="M5 9h1M8 9h1M11 9h1M14 9h1M5 12h10" />
  </>
);

/**
 * Each device form's small picture, drawn like the Plus rail's glyphs: a
 * 20-unit grid, stroked in `currentColor`, so a row lit or muted takes it
 * along. Shaped after the device itself — a mouse dock is a puck with a mouse
 * on it, not a stand — so the list agrees with the desk drawn above it.
 */
const SHAPES: Readonly<Record<TDeviceForm, ReactNode>> = {
  'keyboard-full': keyboard,
  'keyboard-tkl': (
    <>
      <rect x="3.5" y="6" width="13" height="9" rx="2" />
      <path d="M6.5 9h1M9.5 9h1M12.5 9h1M6.5 12h7" />
    </>
  ),
  'keyboard-compact': (
    <>
      <rect x="5" y="6.5" width="10" height="8" rx="2" />
      <path d="M8 9.5h1M11 9.5h1M8 12h4" />
    </>
  ),
  laptop: (
    <>
      <path d="M4.5 13V5.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V13" />
      <path d="M2.5 13h15l-1 2.5h-13z" />
    </>
  ),
  keypad: (
    <>
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h1M10 7h1M13 7h0M7 10h1M10 10h1M7 13h6" />
    </>
  ),
  mouse: (
    <>
      <rect x="6" y="2.5" width="8" height="15" rx="4" />
      <path d="M10 5.5v3" />
    </>
  ),
  'mouse-dock': (
    <>
      <rect x="7" y="2.5" width="6" height="10" rx="3" />
      <ellipse cx="10" cy="14.5" rx="6.5" ry="2.5" />
    </>
  ),
  'charging-pad': (
    <>
      <ellipse cx="10" cy="11" rx="7" ry="4.5" />
      <path d="M10.5 8.5 9 11h2l-1.5 2.5" />
    </>
  ),
  'mouse-bungee': (
    <>
      <path d="M5 16.5h10" />
      <path d="M10 16V9c0-3 2-5 4.5-5.5" />
    </>
  ),
  mousepad: (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
      <rect x="9.5" y="7" width="4" height="6" rx="2" opacity="0.6" />
    </>
  ),
  'desk-mat': (
    <>
      <rect x="1.5" y="6" width="17" height="9" rx="1.5" />
      <path d="M4 9h7M4 11.5h7" opacity="0.6" />
      <rect x="13" y="8.5" width="2.5" height="4" rx="1.2" opacity="0.6" />
    </>
  ),
  headset: (
    <>
      <path d="M4 12V9a6 6 0 0 1 12 0v3" />
      <rect x="3" y="11" width="3.5" height="5.5" rx="1.3" />
      <rect x="13.5" y="11" width="3.5" height="5.5" rx="1.3" />
    </>
  ),
  'headset-stand': (
    <>
      <path d="M10 5v10" />
      <path d="M6 5.5a6 3 0 0 1 8 0" />
      <ellipse cx="10" cy="16" rx="5" ry="1.5" />
    </>
  ),
  speakers: (
    <>
      <rect x="2.5" y="4" width="6" height="12" rx="1.5" />
      <rect x="11.5" y="4" width="6" height="12" rx="1.5" />
      <circle cx="5.5" cy="11.5" r="1.5" />
      <circle cx="14.5" cy="11.5" r="1.5" />
    </>
  ),
  soundbar: (
    <>
      <rect x="1.5" y="8" width="17" height="4.5" rx="2" />
      <path d="M5 14.5h10" opacity="0.6" />
    </>
  ),
  microphone: (
    <>
      <rect x="7" y="2.5" width="6" height="9" rx="3" />
      <path d="M5 9.5a5 5 0 0 0 10 0M10 14.5v2.5M7 17h6" />
    </>
  ),
  'laptop-stand': (
    <>
      <path d="M3 15.5 5 8h10l2 7.5" />
      <path d="M4.5 6h11" />
    </>
  ),
  'monitor-stand': (
    <>
      <path d="M2.5 9h15M4 9v6M16 9v6" />
      <rect x="5.5" y="3" width="9" height="4" rx="1" opacity="0.6" />
    </>
  ),
  dock: (
    <>
      <rect x="3" y="7" width="14" height="7" rx="1.5" />
      <path d="M6 10.5h1.5M9.5 10.5h1.5M13 10.5h1" />
    </>
  ),
  'light-strip': (
    <>
      <path d="M2 10c2.5-3 5.5 3 8 0s5.5 3 8 0" />
      <path d="M4 14h0M8 14h0M12 14h0M16 14h0" opacity="0.6" />
    </>
  ),
  'light-bar': (
    <>
      <rect x="4" y="7" width="12" height="9" rx="1" opacity="0.6" />
      <rect x="3" y="3.5" width="14" height="2.5" rx="1.2" />
    </>
  ),
  lamp: (
    <>
      <rect x="7" y="2.5" width="6" height="11" rx="3" />
      <path d="M6 17h8M10 13.5V17" />
    </>
  ),
  controller: (
    <>
      <path d="M6 6h8c2.5 0 3.5 2 3.5 5s-.8 4.5-2.3 4.5-2.2-2-3.2-2H8c-1 0-1.7 2-3.2 2S2.5 14 2.5 11 3.5 6 6 6z" />
      <path d="M6 9.5v2M5 10.5h2M13.5 10h0M15 11.5h0" />
    </>
  ),
  tower: (
    <>
      <rect x="5.5" y="2.5" width="9" height="15" rx="1.5" />
      <rect x="7.5" y="4.5" width="5" height="8" rx="1" opacity="0.6" />
    </>
  ),
  mixer: (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M6 7v6M10 7v6M14 7v6" opacity="0.6" />
      <path d="M5 9h2M9 11.5h2M13 8.5h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="3" width="15" height="9.5" rx="1.2" />
      <path d="M10 12.5v2.5M5.5 16.5h9" />
    </>
  ),
  chair: (
    <>
      <path d="M6.5 12 5.5 5c-.3-2 1-3 2.5-3h4c1.5 0 2.8 1 2.5 3l-1 7" />
      <path d="M4.5 12h11M10 12v4M6.5 17.5h7" />
    </>
  ),
  accessory: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="2.5" opacity="0.6" />
    </>
  ),
};

export default function LightingFormGlyph({ form }: { form: TDeviceForm }) {
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
      {SHAPES[form]}
    </svg>
  );
}
