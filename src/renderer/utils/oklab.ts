/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Colour arithmetic in OKLab, the space where equal steps look equal, for the
 * scene tint (`sceneTint.ts`) and anything else that tones the theme.
 */

export interface ILab {
  l: number;
  a: number;
  b: number;
}

export interface IRgba {
  /** sRGB channels, 0 to 1. */
  rgb: [number, number, number];
  alpha: number;
}

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export const toGamma = (channel: number) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

// Björn Ottosson's OKLab matrices, as published with the space.
export const rgbToLab = ([red, green, blue]: readonly number[]): ILab => {
  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const labToLinear = ({ l, a, b }: ILab): [number, number, number] => {
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
};

/** A hair of tolerance, so a colour exactly on the gamut's edge counts as in. */
export const GAMUT_EPSILON = 1e-4;

const inGamut = (linear: readonly number[]) =>
  linear.every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  );

/**
 * `lab` pulled toward grey along its own hue until the screen can show it.
 *
 * A dark violet at the chroma a light one carries does not exist in sRGB, and
 * clipping the channels instead turns it into a different hue. Halving the
 * interval sixteen times lands within a fifty-thousandth of the edge.
 */
export const intoGamut = (lab: ILab): [number, number, number] => {
  const direct = labToLinear(lab);
  if (inGamut(direct)) {
    return direct;
  }
  let inside = 0;
  let outside = 1;
  for (let step = 0; step < 16; step += 1) {
    const middle = (inside + outside) / 2;
    const probe = labToLinear({
      l: lab.l,
      a: lab.a * middle,
      b: lab.b * middle,
    });
    if (inGamut(probe)) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return labToLinear({ l: lab.l, a: lab.a * inside, b: lab.b * inside });
};

export const toByte = (linear: number) =>
  Math.round(clamp01(toGamma(clamp01(linear))) * 255);

export const labToHex = (lab: ILab) =>
  `#${intoGamut(lab)
    .map((channel) => toByte(channel).toString(16).padStart(2, '0'))
    .join('')}`;

/** `from` moved `amount` of the way to `chroma` at `hue`, lightness kept. */
export const toward = (
  from: ILab,
  chroma: number,
  hue: number,
  amount: number,
): ILab => {
  const radians = (hue * Math.PI) / 180;
  return {
    l: from.l,
    a: from.a + (chroma * Math.cos(radians) - from.a) * amount,
    b: from.b + (chroma * Math.sin(radians) - from.b) * amount,
  };
};

/** Degrees between two hues the short way round, 0 to 180. */
export const hueDistance = (left: number, right: number) => {
  const apart = Math.abs(left - right) % 360;
  return apart > 180 ? 360 - apart : apart;
};

/** WCAG relative luminance of linear sRGB channels. */
export const luminance = ([red, green, blue]: readonly number[]) =>
  0.2126 * clamp01(red) + 0.7152 * clamp01(green) + 0.0722 * clamp01(blue);

export const contrast = (left: number, right: number) =>
  (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);

const HEX_COLOUR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOUR = /^rgba?\(([^)]+)\)$/i;

const parseChannel = (text: string, scale: number) =>
  text.endsWith('%') ? (Number(text.slice(0, -1)) / 100) * scale : Number(text);

/**
 * A colour as a stylesheet declares one: `#rgb`, `#rrggbb`, either with an
 * alpha, or `rgb()`/`rgba()` with commas or spaces. Anything else — a
 * `color-mix()`, a name — is not something this can tone, and answers
 * undefined so the token is left as its theme wrote it.
 */
export const parseCssColour = (text: string): IRgba | undefined => {
  const value = text.trim();
  const hex = HEX_COLOUR.exec(value);
  if (hex) {
    const digits =
      hex[1].length <= 4
        ? [...hex[1]].map((digit) => digit + digit).join('')
        : hex[1];
    const channel = (index: number) =>
      parseInt(digits.slice(index, index + 2), 16) / 255;
    return {
      rgb: [channel(0), channel(2), channel(4)],
      alpha: digits.length === 8 ? channel(6) : 1,
    };
  }
  const functional = FUNCTIONAL_COLOUR.exec(value);
  if (!functional) {
    return undefined;
  }
  const parts = functional[1]
    .split(/[\s,/]+/)
    .filter((part) => part.length > 0);
  if (parts.length < 3 || parts.length > 4) {
    return undefined;
  }
  const [red, green, blue] = parts
    .slice(0, 3)
    .map((part) => parseChannel(part, 255) / 255);
  const alpha = parts.length === 4 ? parseChannel(parts[3], 1) : 1;
  if (![red, green, blue, alpha].every(Number.isFinite)) {
    return undefined;
  }
  return {
    rgb: [clamp01(red), clamp01(green), clamp01(blue)],
    alpha: clamp01(alpha),
  };
};
