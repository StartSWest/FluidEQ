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
  normalizer: {
    frame: 'M3 5 H17 M3 15 H17',
    accent: 'M5 10 H8 L10 7 L12 13 L14 10 H17',
  },
  // A ragged floor with the wanted signal standing clear of it. The frame is
  // the noise being cut down to a flat line; the accent is the one peak that
  // survives, because this stage is defined by what it LEAVES rather than by
  // what it removes.
  denoise: {
    frame: 'M2 15 L4 12.5 L6 15 L8 11.5 L10 15 L12 12 L14 15 L16 12.5 L18 15',
    accent: 'M10 15 V4 M7.5 6.5 L10 4 L12.5 6.5',
  },
  crossfade: {
    frame: 'M2 6 H6 C9 6 11 14 14 14 H18 M2 14 H6 C9 14 11 6 14 6 H18',
    accent: 'M8 10 H12',
  },
  eq: {
    frame: 'M4 3 V17 M10 3 V17 M16 3 V17',
    accent: 'M1.8 12.5 H6.2 M7.8 6.5 H12.2 M13.8 14.5 H18.2',
  },
  exciter: {
    frame: 'M2 13.5 C4.6 13.5 4.6 8 7.2 8 C9.8 8 9.8 13.5 12.4 13.5',
    accent: 'M16 3.5 V8.5 M13.5 6 H18.5',
  },
  // Two cycles of the source bass, and one cycle of the octave this stage
  // makes from it. The accent is deliberately half the frequency and twice
  // the swing of the frame: that IS the divider, and it is the one picture
  // that cannot be confused with the exciter's bump directly above it.
  bassForge: {
    frame:
      'M2 10 C3 7.5 5 7.5 6 10 C7 12.5 9 12.5 10 10 ' +
      'C11 7.5 13 7.5 14 10 C15 12.5 17 12.5 18 10',
    accent: 'M2 10 C4 4 8 4 10 10 C12 16 16 16 18 10',
  },
  // The two edges of the stereo field, and the picture pushed out to meet
  // them. A double-headed arrow rather than a pair of speakers, because the
  // dial sets how far the image spreads and not what is playing it.
  dimension: {
    frame: 'M3 4.5 V15.5 M17 4.5 V15.5',
    accent: 'M6 10 H14 M8.4 7.6 L6 10 L8.4 12.4 M11.6 7.6 L14 10 L11.6 12.4',
  },
  compressor: {
    frame: 'M3 17 L17 3',
    accent: 'M3 17 L8.5 11.5 C10.5 9.4 12 8.8 17 8.4',
  },
  maximizer: {
    frame: 'M3 4.5 H17',
    accent: 'M10 17 V8 M6.6 11.4 L10 8 L13.4 11.4',
  },
  master: {
    frame: 'M3 4.5 H17 M3 15.5 H17',
    accent: 'M6 10 H14 M11 7 L14 10 L11 13',
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
