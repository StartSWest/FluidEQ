/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The settings tray's glyphs, drawn on the 16px grid its sliders' are. */
const PATHS = {
  // Two faders, their caps at different heights.
  sliders: ['M5 2.5v11', 'M11 2.5v11', 'M3.2 9.5h3.6', 'M9.2 5.5h3.6'],
  // A ball and the air it leaves behind.
  motion: [
    'M10.6 8a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0',
    'M1.8 5.6h2.6',
    'M1.2 8h3',
    'M1.8 10.4h2.6',
  ],
  // Power, for what happens when the machine starts.
  startup: ['M8 2.2v5', 'M4.7 4.4a5 5 0 1 0 6.6 0'],
  // A pin, for the amp's window kept over every other.
  pin: ['M6.3 2.4h3.4l-.5 3.7 2.2 2.3H4.6l2.2-2.3z', 'M8 8.4v5.2'],
  // A globe.
  language: [
    'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0',
    'M2.6 8h10.8',
    'M8 2.5c-1.8 1.6-2.6 3.4-2.6 5.5s0.8 3.9 2.6 5.5',
    'M8 2.5c1.8 1.6 2.6 3.4 2.6 5.5s-0.8 3.9-2.6 5.5',
  ],
} as const;

export type TMenuPreferenceIcon = keyof typeof PATHS;

/**
 * The glyph at the head of a settings row in the titlebar menu, in the same
 * column as the Brightness, Transparency and Rainbow rows' own, so every row
 * in the tray reads glyph, name, control (Ivan, 2026-09-26: "time to also
 * improve this piece of UI").
 */
const MenuPreferenceIcon = ({ name }: { name: TMenuPreferenceIcon }) => (
  <svg className="menu-preference__icon" viewBox="0 0 16 16" aria-hidden>
    {PATHS[name].map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export default MenuPreferenceIcon;
