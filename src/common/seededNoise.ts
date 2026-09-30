/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A repeatable number in [0, 1) for a seed: the same seed gives the same
 * number on every frame and every machine, which is how a drawn scene places
 * its stars, drips, windows and cracks without storing any of them.
 *
 * The shader world's one-liner, `fract(sin(x * 12.9898) * 43758.5453)`, in
 * doubles. Twenty scenes each carried their own copy of it; a change to one
 * copy would have moved that scene's layout and no other.
 */
const noise = (seed: number): number => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export default noise;
