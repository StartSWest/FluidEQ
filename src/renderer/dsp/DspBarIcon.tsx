/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export type TDspBarIcon = 'reset' | 'save' | 'share' | 'import' | 'delete';

/**
 * The glyphs on the preset row, drawn rather than pulled from a font.
 *
 * Five buttons in a row all reading as grey words is a row nobody scans — the
 * eye has to read every label to find the one it wants. A glyph gives each a
 * shape, and the shapes here are the ones these actions have everywhere else:
 * nobody has to learn that an arrow leaving a tray means export.
 *
 * Beside the word rather than instead of it. Icon-only would save the space and
 * cost the meaning: "share" and "import" are two arrows and a box whichever way
 * round they go, and at 14px the difference is a guess.
 */
const PATHS: Record<TDspBarIcon, string> = {
  // A circle that does not quite close, with the arrowhead at its opening.
  reset: 'M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3',
  // Into a tray: the arrow lands on a line.
  save: 'M8 2v7M5.2 6.4 8 9.2l2.8-2.8M3 11.5v1.2A1.3 1.3 0 0 0 4.3 14h7.4a1.3 1.3 0 0 0 1.3-1.3v-1.2',
  // Out of a tray, which is the same shape upside down.
  share:
    'M8 9.2V2.2M5.2 5 8 2.2 10.8 5M3 11.5v1.2A1.3 1.3 0 0 0 4.3 14h7.4a1.3 1.3 0 0 0 1.3-1.3v-1.2',
  // Into the app: an arrow pointing at a box that is open on its left.
  import:
    'M9.6 3H12a1.3 1.3 0 0 1 1.3 1.3v7.4A1.3 1.3 0 0 1 12 13H9.6M2.7 8h6.6M6.8 5.4 9.4 8l-2.6 2.6',
  // A bin, with a lid and two ribs.
  delete:
    'M3.2 4.6h9.6M6.4 4.6V3.3A0.6 0.6 0 0 1 7 2.7h2a0.6 0.6 0 0 1 0.6 0.6v1.3M4.5 4.6l0.5 8a0.7 0.7 0 0 0 0.7 0.7h4.6a0.7 0.7 0 0 0 0.7-0.7l0.5-8M6.9 7v3.8M9.1 7v3.8',
};

interface IDspBarIconProps {
  name: TDspBarIcon;
}

const DspBarIcon = ({ name }: IDspBarIconProps) => (
  <svg className="dsp-bar-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
);

export default DspBarIcon;
