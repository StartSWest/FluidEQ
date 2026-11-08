/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's colour palette (contract 9): a gradient of two to eight colour
 * stops its member edits in the Studio, declared among `pack.json`'s
 * `params` as `{ "type": "palette", "stops": [...] }` and handed to the
 * shader as a 256x1 texture, `uPalette_<id>`, in linear light.
 *
 * It lives in `params` because that is where a scene's controls are written
 * and saved, but it is not a slider: it does not count toward the eight, and
 * a FluidEQ before contract 9 skips nothing here - it read every entry as a
 * slider, so a palette there is a slider that moves nothing, and the shader,
 * naming a texture that build never declares, fails to compile and is drawn
 * as the scene's fallback form, which is what its author chose for that.
 */

export const MIN_PALETTE_STOPS = 2;
export const MAX_PALETTE_STOPS = 8;
/** Palettes a scene may carry, apart from its eight sliders. */
export const MAX_SCENE_PALETTES = 2;
/** The texture's width: a gradient smoother than any eye reads at 8 bits. */
export const PALETTE_TEXELS = 256;
export const PALETTE_TYPE = 'palette';

const HEX = /^#[0-9a-f]{6}$/i;

/** The colours alone: what a member edits and what is saved. */
export interface IScenePaletteValue {
  /** `#rrggbb`, lower case, bass to treble. */
  stops: readonly string[];
  /**
   * Where each stop stands, 0..1, ascending, one per stop. Absent is evenly
   * spaced from 0 to 1, which is what every stock palette is.
   */
  positions?: readonly number[];
}

export const uniformNameForPalette = (id: string): string => `uPalette_${id}`;

/**
 * Whether a `params` entry declares a palette rather than a slider. This
 * file imports nothing, so the server signs palettes with these very bytes
 * (`vendor-member-rules.mjs`).
 */
export const isPaletteEntry = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: unknown }).type === PALETTE_TYPE;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** Evenly spaced positions for `count` stops, 0 and 1 at the ends. */
export const evenPositions = (count: number): number[] =>
  Array.from({ length: count }, (_, index) =>
    count < 2 ? 0 : index / (count - 1),
  );

/** Whether `positions` are the even spacing a palette writes as nothing. */
export const isEvenlySpaced = (positions: readonly number[]): boolean =>
  evenPositions(positions.length).every(
    (even, index) => Math.abs(even - positions[index]) < 1e-3,
  );

/**
 * The colours of a palette as it can be drawn, or `null`.
 *
 * Forgiving, like every reader of a pack (`normalizeScenePack`): a stop that
 * is not a colour is dropped, the stops past eight are dropped, and positions
 * that no longer match the stops are dropped - the colours then stand evenly
 * spaced, which is still the author's colours in the author's order. Only
 * fewer than two colours is not a gradient.
 */
export const readPaletteValue = (
  stops: unknown,
  positions: unknown,
): IScenePaletteValue | null => {
  if (!Array.isArray(stops)) {
    return null;
  }
  const whole = stops.every(
    (stop) => typeof stop === 'string' && HEX.test(stop),
  );
  const colours = stops
    .filter((stop): stop is string => typeof stop === 'string')
    .filter((stop) => HEX.test(stop))
    .map((stop) => stop.toLowerCase());
  if (colours.length < MIN_PALETTE_STOPS) {
    return null;
  }
  const kept = colours.slice(0, MAX_PALETTE_STOPS);
  const placed =
    whole &&
    kept.length === stops.length &&
    Array.isArray(positions) &&
    positions.length === kept.length &&
    positions.every((at) => typeof at === 'number' && Number.isFinite(at))
      ? (positions as number[]).map(clampUnit)
      : undefined;
  if (!placed) {
    return { stops: kept };
  }
  // Stood in order, each colour with its own place: a stop dragged past its
  // neighbour is that colour further along, not the two swapped.
  const order = kept
    .map((stop, index) => ({ stop, at: placed[index] }))
    .sort((a, b) => a.at - b.at);
  const at = order.map((entry) => Math.round(entry.at * 1000) / 1000);
  return {
    stops: order.map((entry) => entry.stop),
    ...(isEvenlySpaced(at) ? {} : { positions: at }),
  };
};

/**
 * Whether a palette's colours are whole as its author wrote them: two to
 * eight `#rrggbb` stops, and positions, if given, one a stop, 0 to 1, in
 * order. The Studio's check and the server's (`checkProjectParams`,
 * `memberpack.ts`), which name a mistake where the reader above quietly
 * repairs it.
 */
export const isWholePaletteColours = (
  stops: unknown,
  positions: unknown,
): boolean => {
  if (
    !Array.isArray(stops) ||
    stops.length < MIN_PALETTE_STOPS ||
    stops.length > MAX_PALETTE_STOPS ||
    !stops.every((stop) => typeof stop === 'string' && HEX.test(stop))
  ) {
    return false;
  }
  if (positions === undefined) {
    return true;
  }
  return (
    Array.isArray(positions) &&
    positions.length === stops.length &&
    positions.every(
      (at, index) =>
        typeof at === 'number' &&
        Number.isFinite(at) &&
        at >= 0 &&
        at <= 1 &&
        (index === 0 || at >= (positions[index - 1] as number)),
    )
  );
};

/** Where each stop stands: its own position, or evenly spaced. */
export const paletteStops = (
  value: IScenePaletteValue,
): { colour: string; at: number }[] => {
  const at = value.positions ?? evenPositions(value.stops.length);
  return value.stops.map((colour, index) => ({ colour, at: at[index] }));
};

export const paletteKey = (value: IScenePaletteValue): string =>
  `${value.stops.join(',')}|${value.positions?.join(',') ?? ''}`;

export const samePalette = (
  a: IScenePaletteValue,
  b: IScenePaletteValue,
): boolean => paletteKey(a) === paletteKey(b);

/** The colours alone, as they are saved. */
export const paletteValueOf = (
  palette: IScenePaletteValue,
): IScenePaletteValue => ({
  stops: [...palette.stops],
  ...(palette.positions ? { positions: [...palette.positions] } : {}),
});

/** The same palette the other way round: treble to bass. */
export const reversedPalette = (
  value: IScenePaletteValue,
): IScenePaletteValue => {
  const stops = paletteStops(value)
    .map(({ colour, at }) => ({ colour, at: 1 - at }))
    .reverse();
  const positions = stops.map((stop) => Math.round(stop.at * 1000) / 1000);
  return {
    stops: stops.map((stop) => stop.colour),
    ...(isEvenlySpaced(positions) ? {} : { positions }),
  };
};

// ---------------------------------------------------------------------------
// The gradient itself.
//
// Mixed in OKLab (Björn Ottosson's), where a halfway colour looks halfway:
// mixed in sRGB, red to green passes through a muddy brown, and in linear
// light every middle washes out toward white. The Studio's strip is drawn
// from these same numbers (`paletteCss`), so what the member sees on the
// strip is what the scene is handed.

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const toSrgb = (channel: number) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

type TTriple = [number, number, number];

/** `#rrggbb` in linear light. */
export const hexToLinear = (hex: string): TTriple => [
  toLinear(parseInt(hex.slice(1, 3), 16) / 255),
  toLinear(parseInt(hex.slice(3, 5), 16) / 255),
  toLinear(parseInt(hex.slice(5, 7), 16) / 255),
];

const linearToOklab = ([r, g, b]: TTriple): TTriple => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const oklabToLinear = ([lightness, a, b]: TTriple): TTriple => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clampUnit(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clampUnit(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clampUnit(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

/**
 * The palette across `count` samples, sample `i` at `t = i / (count - 1)`,
 * so the first and last are exactly the end colours; in linear light, three
 * floats a sample. Before the first stop and past the last, their colour.
 */
export const paletteLinear = (
  value: IScenePaletteValue,
  count = PALETTE_TEXELS,
): Float32Array => {
  const stops = paletteStops(value).map(({ colour, at }) => ({
    at,
    lab: linearToOklab(hexToLinear(colour)),
  }));
  const out = new Float32Array(count * 3);
  let next = 0;
  for (let i = 0; i < count; i += 1) {
    const t = count < 2 ? 0 : i / (count - 1);
    while (next < stops.length && stops[next].at < t) {
      next += 1;
    }
    let lab: TTriple;
    if (next === 0) {
      lab = stops[0].lab;
    } else if (next === stops.length) {
      lab = stops[stops.length - 1].lab;
    } else {
      const from = stops[next - 1];
      const to = stops[next];
      const span = to.at - from.at;
      const k = span > 1e-6 ? (t - from.at) / span : 1;
      lab = [
        from.lab[0] + (to.lab[0] - from.lab[0]) * k,
        from.lab[1] + (to.lab[1] - from.lab[1]) * k,
        from.lab[2] + (to.lab[2] - from.lab[2]) * k,
      ];
    }
    out.set(oklabToLinear(lab), i * 3);
  }
  return out;
};

/**
 * The palette as the GPU is handed it: RGBA bytes, sRGB-encoded, for an
 * `SRGB8_ALPHA8` texture, which the GPU turns back into linear light before
 * it filters - so the shader reads linear, and the dark end keeps the
 * precision eight bits of linear would have spent on the bright one.
 */
export const paletteTexels = (value: IScenePaletteValue): Uint8Array => {
  const linear = paletteLinear(value, PALETTE_TEXELS);
  const bytes = new Uint8Array(PALETTE_TEXELS * 4);
  for (let i = 0; i < PALETTE_TEXELS; i += 1) {
    bytes[i * 4] = Math.round(toSrgb(linear[i * 3]) * 255);
    bytes[i * 4 + 1] = Math.round(toSrgb(linear[i * 3 + 1]) * 255);
    bytes[i * 4 + 2] = Math.round(toSrgb(linear[i * 3 + 2]) * 255);
    bytes[i * 4 + 3] = 255;
  }
  return bytes;
};

const hexByte = (channel: number) =>
  Math.round(toSrgb(channel) * 255)
    .toString(16)
    .padStart(2, '0');

/**
 * A CSS gradient of the palette, sampled from the numbers the scene gets
 * rather than left to the browser's own mixing, which would differ.
 */
export const paletteCss = (
  value: IScenePaletteValue,
  direction = '90deg',
): string => {
  const samples = 33;
  const linear = paletteLinear(value, samples);
  const parts = Array.from({ length: samples }, (_, i) => {
    const colour = `#${hexByte(linear[i * 3])}${hexByte(linear[i * 3 + 1])}${hexByte(linear[i * 3 + 2])}`;
    return `${colour} ${((i / (samples - 1)) * 100).toFixed(2)}%`;
  });
  return `linear-gradient(${direction}, ${parts.join(', ')})`;
};

/** The colour a palette has at `t`, as `#rrggbb`: what a new stop is given. */
export const paletteColourAt = (
  value: IScenePaletteValue,
  t: number,
): string => {
  const samples = PALETTE_TEXELS;
  const linear = paletteLinear(value, samples);
  const i = Math.round(clampUnit(t) * (samples - 1));
  return `#${hexByte(linear[i * 3])}${hexByte(linear[i * 3 + 1])}${hexByte(linear[i * 3 + 2])}`;
};

// ---------------------------------------------------------------------------
// The stock palettes the Studio's Presets menu offers, four stops each, bass
// to treble. The perceptual maps (Viridis, Magma, Inferno, Plasma, Turbo)
// keep their published names; the rest are named in each language
// (`studio.palette.preset.<id>`).

export const PALETTE_PRESET_IDS = [
  'rainbow',
  'viridis',
  'magma',
  'inferno',
  'plasma',
  'turbo',
  'sunset',
  'ocean',
  'fire',
  'ice',
  'neon',
  'vaporwave',
  'aurora',
  'forest',
  'gold',
  'pastel',
  'cool',
  'spring',
  'tropical',
  'chrome',
] as const;

export type TPalettePresetId = (typeof PALETTE_PRESET_IDS)[number];

export const PALETTE_PRESETS: Record<TPalettePresetId, readonly string[]> = {
  rainbow: ['#ff3030', '#ffd21f', '#2fd66b', '#6b4cff'],
  viridis: ['#46327e', '#277f8e', '#4ac16d', '#fde725'],
  magma: ['#51127c', '#b73779', '#fc8961', '#fcfdbf'],
  inferno: ['#57106e', '#bc3754', '#f98e09', '#fcffa4'],
  plasma: ['#5302a3', '#b12a90', '#e16462', '#fca636'],
  turbo: ['#4777ef', '#1be5b5', '#f0cc3a', '#e4460a'],
  sunset: ['#6a3093', '#c2185b', '#ff6f3c', '#ffc93c'],
  ocean: ['#0a3d91', '#1e7fd1', '#18c6c3', '#b8f3ff'],
  fire: ['#b31b1b', '#ff4b1f', '#ff9a1f', '#ffe36e'],
  ice: ['#3a6fd8', '#5fb8f0', '#a8e6ff', '#f2fbff'],
  neon: ['#ff00e6', '#8a2bff', '#00e5ff', '#39ff88'],
  vaporwave: ['#ff71ce', '#b967ff', '#01cdfe', '#05ffa1'],
  aurora: ['#00ff9f', '#00c2c7', '#3d7bff', '#b14dff'],
  forest: ['#1f6b3a', '#3fa34d', '#8fd14f', '#e2f27a'],
  gold: ['#8c5a1e', '#c9892c', '#f2c14e', '#fff1b8'],
  pastel: ['#ffb3ba', '#ffdfba', '#baffc9', '#bae1ff'],
  cool: ['#00ffff', '#55aaff', '#aa55ff', '#ff00ff'],
  spring: ['#ff00ff', '#ff55aa', '#ffaa55', '#ffff00'],
  tropical: ['#00b3a4', '#4ade80', '#facc15', '#fb7185'],
  chrome: ['#6f7a86', '#a7b1bc', '#dde3ea', '#ffffff'],
};
