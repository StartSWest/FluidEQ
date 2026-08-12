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

  // The graph had three pinks within a few degrees of hue of each other —
  // convolution #ff3cac, the total #ff4f9a and triadic2 #ff4fd8 — which made
  // the curves genuinely hard to tell apart. These are deliberately far from
  // everything else on the wheel.
  /** Driver compensation layer. */
  DRIVER = '#ffb648',
  /**
   * The measured Smart EQ layer. Azure: the last free slot between the violet
   * voicing at 258 degrees and the cyan EQ line at 175, and far enough from the
   * near-white total to read as a curve of its own rather than part of it.
   */
  SMART = '#3d9bff',
  /**
   * The published headphone correction.
   *
   * Magenta, which is uncomfortably close to the pinks above and is still the
   * best slot left: with amber, cyan, violet, azure and near-white spoken for,
   * every remaining hue is either a red — which on this plot means the clip
   * badge — or a green, which is what the live trace is drawn in by default.
   *
   * Measured rather than eyeballed, because "close to the pinks" is exactly the
   * mistake recorded above. Composited at the half opacity every supporting
   * curve is drawn at, this sits 27 and 28 CIELAB units from the convolution
   * pink and the voicing violet, against 30 for the closest pair the palette
   * already had and 15 for the two the note above calls hard to tell apart. And
   * it is 88 from the driver amber, which is the one that matters most: driver
   * and headphone are both transducer corrections and are the two most likely
   * to be on the plot together.
   */
  HEADPHONE = '#ff0af5',
  /** The sum of every layer, kept neutral so it reads as a result. */
  TOTAL = '#dbe7ff',
  /** The user's own custom APO commands. */
  CUSTOM = '#ff7a45',
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

/**
 * The colour each layer is drawn in on the graph, keyed by `TApoLayer`.
 *
 * The chip row, the plot and the config panel describe the same chain, and
 * until now nothing said which line was which: four supporting curves in four
 * colours above a row of four chips in none, and the only way to pair them up
 * was to switch a layer off and watch what disappeared.
 *
 * Each is the `ColorEnum` the chart passes for that curve, taken from it rather
 * than written out again, so a swatch cannot come to name a colour that is not
 * on the plot.
 *
 * The EQ is the cyan its curve is drawn in, not the band spectrum that curve is
 * shaded with. A twelve-pixel rainbow reads as decoration rather than as a
 * colour key — and the whole job of these is to be matched against a line at a
 * glance.
 *
 * It lives here, beside the enums it is built from, rather than in the chip row
 * that first needed it. The config panel wants the same mapping so that a pill,
 * a chip and a curve all agree, and importing it from a component would have
 * dragged that component's whole dependency graph — and its stylesheet — into a
 * panel that only wanted five hex values.
 */
export const LAYER_SWATCH: Record<string, string> = {
  convolution: ColorEnum.COMPLEMENTARY,
  driver: ColorEnum.DRIVER,
  // Missing until now, which is why the headphone chip drew a swatch with no
  // background at all and its file in the config panel got the default edge:
  // the layer existed everywhere except in the one map that says what colour it
  // is. Keyed by `TApoLayer`, so every layer that can be written needs a row.
  headphone: ColorEnum.HEADPHONE,
  eq: SecondaryColorEnum.DEFAULT,
  voicing: ColorEnum.TRIADIC1,
  smart: ColorEnum.SMART,
  custom: ColorEnum.CUSTOM,
};
