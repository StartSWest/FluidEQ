/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE BELL DRAG (Ivan, 2026-09-28: "if I select multiple bands and move them
 * with control pressed it will create a bell move on all bands, using their
 * Q setting as the bell curve, using the center band as the tip").
 *
 * How far a band of a group moves when the group is dragged with Ctrl held:
 * the height, at the band's frequency, of a peaking filter centred on the
 * band that was grabbed, as wide as that band's Q and as tall as the drag.
 * The grabbed band moves by the whole drag and the rest by less the further
 * they stand from it, the shape a bell of that Q draws, so Ctrl+scroll, which
 * sets the selection's Q, widens the bell or narrows it.
 *
 * The analogue peaking prototype of the cookbook, in dB: exactly `gain` at
 * the centre, and falling away the same in either direction in log
 * frequency. Nothing for no gain, and nothing for a frequency, centre or Q
 * that is not positive, which no band has.
 */
const bellGainAt = (
  frequency: number,
  centre: number,
  quality: number,
  gain: number,
): number => {
  if (gain === 0 || !(frequency > 0 && centre > 0 && quality > 0)) {
    return 0;
  }
  const amplitude = 10 ** (gain / 40);
  const ratio = frequency / centre;
  const away = (1 - ratio * ratio) ** 2;
  const top = away + ((ratio * amplitude) / quality) ** 2;
  const bottom = away + (ratio / (amplitude * quality)) ** 2;
  return 10 * Math.log10(top / bottom);
};

export default bellGainAt;
