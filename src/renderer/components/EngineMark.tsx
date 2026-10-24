/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A tick or a dash beside each line.
 *
 * Stroked rather than a text glyph: "✓" and "–" come from whichever font the
 * platform happens to have them in, so the same two marks were three
 * different weights and two different heights across Windows, macOS and
 * Ubuntu. These are the same shape everywhere and take their colour from the
 * line they belong to.
 */
const Mark = ({ kind }: { kind: 'yes' | 'no' }) => (
  <svg
    className={`engine-dialog__mark engine-dialog__mark--${kind}`}
    viewBox="0 0 14 14"
    aria-hidden="true"
  >
    {kind === 'yes' ? (
      <path d="M2.6 7.3l2.9 2.9L11.4 4" />
    ) : (
      <path d="M3.2 7h7.6" />
    )}
  </svg>
);

export default Mark;
