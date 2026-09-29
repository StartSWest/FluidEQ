/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';

// The dB scale beside the EQ page's sliders: a mark every 5 dB of their
// travel, how each is drawn, and how each is labelled.

/** Every 5 dB of the sliders' travel, from the top: the scale beside them. */
export const EQ_SCALE_MARKS = Array.from(
  { length: (MAX_GAIN - MIN_GAIN) / 5 + 1 },
  (_, index) => MAX_GAIN - index * 5,
);

/** 0 dB lit, the tens numbered plainly, the fives between them quieter and
 * dropped on a short track (`.eq-scale`). */
export const eqScaleMarkClass = (gain: number) => {
  if (gain === 0) {
    return ' is-zero';
  }
  return gain % 10 === 0 ? '' : ' is-minor';
};

/** Signed as the graph's scale is, with a true minus, and the unit at 0. */
export const eqScaleLabel = (gain: number) => {
  if (gain === 0) {
    return '0 dB';
  }
  return gain > 0 ? `+${gain}` : `−${-gain}`;
};
