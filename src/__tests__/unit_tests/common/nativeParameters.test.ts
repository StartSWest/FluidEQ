/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  NATIVE_DSP_PARAMETER_COUNT,
  NATIVE_DSP_PARAMETERS,
} from '../../../common/dsp/nativeParameters';

describe('the native DSP parameter table', () => {
  /**
   * 2000-2199 is claimed for the two bass stages, not merely used for them.
   *
   * Two branches were adding native-only stages against this same append-only
   * table at once; a wire lead can be renumbered when the second branch
   * merges, but an id cannot, because a stored automation follows the number
   * rather than the path. This is the check that the reservation held after
   * that merge, and that none of the sixteen ids collided with a twin.
   */
  it('reserves 2000-2199 for the bass stages and burns nothing', () => {
    const bass = NATIVE_DSP_PARAMETERS.filter(
      (p) => p.id >= 2000 && p.id < 2200,
    );
    expect(bass).toHaveLength(16);
    expect(new Set(bass.map((p) => p.id)).size).toBe(16);
    expect(NATIVE_DSP_PARAMETER_COUNT).toBe(NATIVE_DSP_PARAMETERS.length);
  });
});
