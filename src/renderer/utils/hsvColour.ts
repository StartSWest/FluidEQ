/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A colour as a picker moves it (`ColourPickerPopover.tsx`): hue 0 to 360,
 * saturation and value 0 to 1 - the field and the bar a picker is drawn as,
 * in the sRGB the swatches and `#rrggbb` are written in.
 */
export interface IHsv {
  h: number;
  s: number;
  v: number;
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** `text` as `#rrggbb` in lower case, or undefined; `#abc` is read as `#aabbcc`. */
export const readHexColour = (text: string): string | undefined => {
  const match = HEX.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const digits =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : match[1];
  return `#${digits.toLowerCase()}`;
};

export const hsvOfHex = (hex: string): IHsv => {
  const value = readHexColour(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map(
    (at) => parseInt(value.slice(at, at + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  let h = 0;
  if (span > 0) {
    if (max === r) {
      h = ((g - b) / span) % 6;
    } else if (max === g) {
      h = (b - r) / span + 2;
    } else {
      h = (r - g) / span + 4;
    }
  }
  return {
    h: (h * 60 + 360) % 360,
    s: max === 0 ? 0 : span / max,
    v: max,
  };
};

export const hexOfHsv = ({ h, s, v }: IHsv): string => {
  const chroma = v * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const sectors: [number, number, number][] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  const [r, g, b] = sectors[Math.min(5, Math.floor(sector))];
  const m = v - chroma;
  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};
