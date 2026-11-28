/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_FREQUENCY, MIN_FREQUENCY } from 'common/constants';

/**
 * Where a band added with nothing selected goes: 1 kHz, or the first whole
 * hertz above it no band stands on, or failing that the first below it.
 * Undefined when every hertz is taken. Shared by the EQ page's Add and the
 * amp's, so the two never put a new band in different places.
 */
const freeBandFrequency = (
  occupied: ReadonlySet<number>,
): number | undefined => {
  for (let frequency = 1000; frequency <= MAX_FREQUENCY; frequency += 1) {
    if (!occupied.has(frequency)) {
      return frequency;
    }
  }
  for (let frequency = 999; frequency >= MIN_FREQUENCY; frequency -= 1) {
    if (!occupied.has(frequency)) {
      return frequency;
    }
  }
  return undefined;
};

export default freeBandFrequency;
