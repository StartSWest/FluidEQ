/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

// Primary
export enum PrimaryColorEnum {
  DARK = '#090516',
  DEFAULT = '#17122b',
  LIGHT = '#2b2350',
  LIGHTER = '#d8d2ff',
}

// Secondary
export enum SecondaryColorEnum {
  DARKER = '#007f95',
  DARK = '#00a9d6',
  DEFAULT = '#00e5cf',
  LIGHT = '#9cfff4',
}

export enum ColorEnum {
  // Complementary
  COMPLEMENTARY = '#ff3cac',

  // Triadic
  TRIADIC1 = '#8b5cff',
  TRIADIC2 = '#ff4fd8',

  // Analogous
  ANALOGOUS1 = '#ff4f9a',
  ANALOGOUS2 = '#54ff8a',
}

export enum GrayScaleEnum {
  BLACK = '#000000',
  WHITE = '#ffffff',
}

export const getColor = (index: number) => {
  const colors = Object.values(ColorEnum);
  return colors[index % colors.length];
};

export type Color =
  PrimaryColorEnum | SecondaryColorEnum | ColorEnum | GrayScaleEnum;
