/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

/**
 * Ten ways to draw the same level reading in the sidebar's output meter.
 *
 * The shapes themselves live in `OutputLevelMeter.tsx` — a canvas ignores
 * SVG path data — but the cycle order, the storage key and the two step
 * helpers are here so both the component and its tests read from the same
 * list and the pair can never disagree about which style comes next.
 */

export type MeterStyle =
  | 'bar'
  | 'segments'
  | 'leds'
  | 'fluid'
  | 'mercury'
  | 'needle'
  | 'pulse'
  | 'stack'
  | 'flow'
  | 'center';

/** Cycle order. Click walks these; Ctrl+click walks them backwards. */
export const METER_STYLES: MeterStyle[] = [
  'bar',
  'segments',
  'leds',
  'fluid',
  'mercury',
  'needle',
  'pulse',
  'stack',
  'flow',
  'center',
];

/** Where the chosen meter style is remembered. */
export const METER_STYLE_KEY = 'fluideq-meter-style';
