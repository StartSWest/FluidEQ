/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TDspSection } from './sections';

/**
 * One glyph per processor, in a 20x20 box.
 *
 * Each is the picture that processor's own front panel would use: faders for
 * the equaliser, a transfer curve with a knee for the compressor, a ceiling
 * with something pushed up against it for the maximizer. Drawn rather than
 * lettered so the rail survives being narrowed to the icons alone, which is
 * what it does once the window is too narrow to carry the names.
 *
 * Two paths each, and they are not interchangeable: the frame is the dim
 * scaffolding and the accent is the part that says which processor this is.
 * The compressor's frame is its unity diagonal — a knee alone is just a bent
 * line, and the diagonal behind it is what makes the bend read as gain against
 * input.
 */
const GLYPHS: Record<TDspSection, { frame: string; accent: string }> = {
  eq: {
    frame: 'M4 3 V17 M10 3 V17 M16 3 V17',
    accent: 'M1.8 12.5 H6.2 M7.8 6.5 H12.2 M13.8 14.5 H18.2',
  },
  exciter: {
    frame: 'M2 13.5 C4.6 13.5 4.6 8 7.2 8 C9.8 8 9.8 13.5 12.4 13.5',
    accent: 'M16 3.5 V8.5 M13.5 6 H18.5',
  },
  compressor: {
    frame: 'M3 17 L17 3',
    accent: 'M3 17 L8.5 11.5 C10.5 9.4 12 8.8 17 8.4',
  },
  maximizer: {
    frame: 'M3 4.5 H17',
    accent: 'M10 17 V8 M6.6 11.4 L10 8 L13.4 11.4',
  },
};

interface IDspSectionIconProps {
  section: TDspSection;
}

const DspSectionIcon = ({ section }: IDspSectionIconProps) => (
  <svg
    className={`dsp-section-icon dsp-section-icon--${section}`}
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path className="dsp-section-icon__frame" d={GLYPHS[section].frame} />
    <path className="dsp-section-icon__accent" d={GLYPHS[section].accent} />
  </svg>
);

export default DspSectionIcon;
