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

import { rainbowRgbAt } from './rainbowPalette';

export interface IBandColor {
  color: string;
  muted: string;
  track: string;
}

/**
 * A band's colour where Rainbow mode draws the bands in colour, `progress` its
 * place low to high. Rainbow mode's palette (`rainbowPalette.ts`): Lagoon, or
 * the Plus visualizer's own colours while one is chosen. Outside the mode
 * every one of these places draws the accent instead, so this is the mode's
 * alone; the graph's looks take the window's colours (`windowInk.ts`). A
 * component hands the palette it read with `useRainbowStops`, so it draws
 * again when the visualizer changes it.
 */
export const getBandColor = (
  progress: number,
  palette?: readonly string[],
): IBandColor => {
  const rgb = rainbowRgbAt(progress, palette);
  const color = `rgb(${rgb.join(', ')})`;
  // The hue is at full strength; these two say how much of the column
  // carries it. At 0.38 and 0.1 almost everything a band showed was the dot
  // and the arrows — the track between them was a tenth of a colour over a
  // dark card, which is a grey line, so a row of full-saturation bands read
  // as pale. Two thirds and a quarter keep the reading the brightest thing
  // on the band while letting the column itself be the colour it is.
  return {
    color,
    muted: `rgba(${rgb.join(', ')}, 0.62)`,
    track: `rgba(${rgb.join(', ')}, 0.26)`,
  };
};
