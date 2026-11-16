/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';

/**
 * The `--fill` the app's one slider paints its accent up to
 * (`toggle-knob-slider` in `_themeMixins.scss`): the value's share of the
 * range, as a percentage. A WebKit range draws no fill of its own, so a
 * slider without this shows only its empty line.
 */
const rangeFill = (value: number, min: number, max: number): CSSProperties => {
  const share = max > min ? (value - min) / (max - min) : 0;
  return {
    '--fill': `${Math.min(100, Math.max(0, share * 100))}%`,
  } as CSSProperties;
};

export default rangeFill;
