/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** `value` held between `min` and `max`, both included. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export default clamp;
