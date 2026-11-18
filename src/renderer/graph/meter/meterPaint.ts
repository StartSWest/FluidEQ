/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { MeterStyle } from 'common/meterStyles';
import { LEVEL_HOT_DB, LEVEL_OVER_DB, levelFraction } from '../outputLevel';
import { readSurface, type TSurfaceName } from '../../utils/theme';
import {
  LINE_ON_WHITE,
  clearedFor,
  rainbowColourAt,
  rainbowGradientStops,
} from '../../utils/rainbowPalette';

/**
 * What every style of the side meter is painted with: the reading's ramp,
 * the zones, the pen that keeps an edge on a device pixel.
 *
 * One flat language for all ten (Ivan, 2026-09-26: "fix all meters in the
 * side, improve them to look clean", "no glow on meter I like sharp and
 * clean border"): each strip is the same slot with a one-pixel border, the
 * reading is flat colour in the window's own ramp, the zones above -12 dBFS
 * keep their warning colours, and nothing is blurred, glazed or haloed.
 * What tells the styles apart is their geometry.
 */

export type TZone = 'safe' | 'hot' | 'over' | 'clip';

export interface IChannelLevel {
  /** 0..1 of the meter's floor..0 dBFS range. */
  level: number;
  peak: number;
  zone: TZone;
  peakZone: TZone;
}

/** A channel's strip within the canvas, in CSS pixels. */
export interface IChannelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IRampStop {
  offset: number;
  colour: string;
}

/**
 * Where the meter's two zone boundaries sit on the strip.
 *
 * Derived from the thresholds rather than written as 0.8 and 0.95, so
 * moving `LEVEL_HOT_DB` or `LEVEL_OVER_DB` moves the colours with them
 * instead of quietly sliding them away from the decibels they are named
 * for.
 */
export const HOT_FRACTION = levelFraction(LEVEL_HOT_DB);
export const OVER_FRACTION = levelFraction(LEVEL_OVER_DB);

type TWarnZone = Exclude<TZone, 'safe'>;

/**
 * The zones' colours, held out of the mode — a clipped peak stays red in
 * Rainbow mode too, because the warning is what the colour means.
 */
export const ZONE_COLOURS: Readonly<Record<TWarnZone, string>> = {
  hot: '#ffd24a',
  // Near the ceiling is caution, not proof of clipped samples: a correctly
  // limited -1 dBTP master must not wear the red of a signal on the rail.
  over: '#ff9d4a',
  clip: '#ff5a6e',
};

/**
 * The same three on a light window: a deep gold, a burnt orange and a red,
 * the warning hues a white page writes in. The dark window's are lamps lit
 * on a night floor - amber at OKLab 0.88 - and on white they were a pale
 * yellow and a pastel orange on pale grey cells, 1.2:1 and 1.6:1 against
 * an unlit lamp (Ivan, 2026-11-18: "the meter's peak colours are too light,
 * they don't look good").
 */
export const LIGHT_ZONE_COLOURS: Readonly<Record<TWarnZone, string>> = {
  hot: '#9a6700',
  over: '#b54700',
  clip: '#cf222e',
};

/**
 * What a lit lamp keeps against an unlit one: the 3:1 a graphical object
 * needs (WCAG 1.4.11), the line the window's palette is already held to on
 * white (`LINE_ON_WHITE`).
 */
const LIT_ON_UNLIT = LINE_ON_WHITE;

/**
 * The colours one frame of the meter is drawn in. Every lit colour - the
 * ramp's stops, the zones, safe's crest - is moved in lightness, its hue
 * kept, until it stands at `LIT_ON_UNLIT` against the unlit lamp it is read
 * beside (`clearedFor`): down on a light window, up on a dark one, and not
 * at all where it already does. On white the window's palette is held at
 * 3:1 on the page, and against the grey of an unlit cell that was 2:1; on a
 * dark window a dark first colour (a deep teal picked in the Tint) drew the
 * ladder's foot at 1.05:1, lamps that were on and looked off. Solved against
 * the cell as it is painted, so the soft grey end of the Brightness moves
 * them further and pure white less; Lagoon on a dark window moves nothing.
 */
export interface IMeterInks {
  /** A lit colour as this frame draws it. */
  lit: (colour: string) => string;
  zones: Readonly<Record<TWarnZone, string>>;
  /** Safe's reading: the primary's light, the crest of its ramp. */
  safe: string;
}

const asWritten = (colour: string) => colour;

/**
 * `ground` is the unlit lamp's relative luminance (undefined where it
 * cannot be read, and nothing moves), `isLight` the window's side.
 */
export const meterInks = (
  ground: number | undefined,
  isLight: boolean,
): IMeterInks => {
  const safe = readSurface('--accent-light', '#c8fff8');
  const written = isLight ? LIGHT_ZONE_COLOURS : ZONE_COLOURS;
  if (ground === undefined) {
    return { lit: asWritten, zones: written, safe };
  }
  const lit = (colour: string) =>
    clearedFor(colour, ground, LIT_ON_UNLIT, isLight);
  return {
    lit,
    zones: {
      hot: lit(written.hot),
      over: lit(written.over),
      clip: lit(written.clip),
    },
    safe: lit(safe),
  };
};

/** `stops` as this frame draws them (`IMeterInks`). */
export const litStops = (
  inks: IMeterInks,
  stops: readonly IRampStop[],
): readonly IRampStop[] =>
  inks.lit === asWritten
    ? stops
    : stops.map((stop) => ({ ...stop, colour: inks.lit(stop.colour) }));

/**
 * A reading's colour — a peak line, a pointer, a held lamp, a tip — by zone:
 * the warnings keep theirs, and safe is the primary's light, the crest of
 * the ramp it stands over. Safe was two literals, an ice white and a green,
 * so on a theme or a visualizer's colours the one thing to read on the
 * meter was the one colour not the window's.
 */
export const zoneColour = (pen: IMeterPen, zone: TZone): string =>
  zone === 'safe' ? pen.inks.safe : pen.inks.zones[zone];

/**
 * Normal mode's ramp: the primary's own walk, its dark at the foot. It
 * started from the darker still, which on a slate slot read as the reading
 * fading into the background (Ivan, 2026-09-26: "make meters more visible
 * and its bg bit less visible but its color more visible").
 */
const WALK: readonly (readonly [number, TSurfaceName, string])[] = [
  [0, '--accent-dark', '#0095c8'],
  [0.4, '--accent', '#00c5ff'],
  [1, '--accent-light', '#c8fff8'],
];

/**
 * A lamp is lit or it is not, so a ladder's ramp has no dark foot: the
 * bottom lamps came out dimmer than the ones above them, which reads as
 * half-lit rather than as lit low.
 */
const LAMP_WALK: readonly (readonly [number, TSurfaceName, string])[] = [
  [0, '--accent', '#39d7ff'],
  [0.5, '--accent', '#00c5ff'],
  [1, '--accent-light', '#c8fff8'],
];

const walkStops = (
  walk: readonly (readonly [number, TSurfaceName, string])[],
): IRampStop[] =>
  walk.map(([offset, token, fallback]) => ({
    offset,
    colour: readSurface(token, fallback),
  }));

/**
 * The body's ramp in the mode: the primary's walk in Normal mode, the
 * rainbow in use (Lagoon, or a Plus visualizer's) in Rainbow mode.
 */
export const bodyStops = (isRainbow: boolean): readonly IRampStop[] =>
  isRainbow ? rainbowGradientStops() : walkStops(WALK);

export const lampStops = (isRainbow: boolean): readonly IRampStop[] =>
  isRainbow ? rainbowGradientStops() : walkStops(LAMP_WALK);

/**
 * One colour, walked round Rainbow mode's palette by the clock, for the two
 * ladders in Rainbow mode: the whole strip is a single colour at any
 * instant and that colour travels, rather than every colour being on
 * screen at once — a spectrum across an eighteen-pixel strip is noise.
 */
export const travellingStops = (nowMs: number): readonly IRampStop[] => {
  const phase = nowMs / 30000;
  return [
    { offset: 0, colour: rainbowColourAt(phase, -0.18) },
    { offset: 0.55, colour: rainbowColourAt(phase) },
    { offset: 1, colour: rainbowColourAt(phase + 0.094, 0.12) },
  ];
};

/**
 * The ramp up a strip, with the zones on its tip.
 *
 * The body takes the given palette compressed into the part of the strip
 * that is not a warning; amber starts AT -12 dBFS and orange at -3 with
 * hard stops, so a colour belongs to a decibel rather than to a gradient
 * position. A strip that is only the mode's colour says which mode the app
 * is in and nothing about how close the sound is to the ceiling.
 */
export const levelRamp = (
  pen: IMeterPen,
  rect: IChannelRect,
  stops: readonly IRampStop[],
): CanvasGradient => {
  const { zones } = pen.inks;
  const gradient = pen.context.createLinearGradient(
    0,
    rect.y + rect.height,
    0,
    rect.y,
  );
  stops.forEach((stop) => {
    gradient.addColorStop(stop.offset * HOT_FRACTION, stop.colour);
  });
  gradient.addColorStop(HOT_FRACTION, zones.hot);
  gradient.addColorStop(OVER_FRACTION, zones.hot);
  gradient.addColorStop(OVER_FRACTION, zones.over);
  gradient.addColorStop(1, zones.over);
  return gradient;
};

/**
 * The same ramp mirrored about the middle of the strip, for the style that
 * grows out of the centre: distance from the centre carries it, so both
 * arms of one reading are one colour and a loud passage goes hot at both
 * ends together. Canvas resolves stops sharing an offset in insertion
 * order, which is what keeps the zone edges hard — so the two halves are
 * added in increasing position rather than as one loop.
 */
export const mirroredRamp = (
  pen: IMeterPen,
  rect: IChannelRect,
  stops: readonly IRampStop[],
): CanvasGradient => {
  const { zones } = pen.inks;
  const gradient = pen.context.createLinearGradient(
    0,
    rect.y,
    0,
    rect.y + rect.height,
  );
  const above = (distance: number) => 0.5 - distance / 2;
  const below = (distance: number) => 0.5 + distance / 2;
  gradient.addColorStop(above(1), zones.over);
  gradient.addColorStop(above(OVER_FRACTION), zones.over);
  gradient.addColorStop(above(OVER_FRACTION), zones.hot);
  gradient.addColorStop(above(HOT_FRACTION), zones.hot);
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index];
    gradient.addColorStop(above(stop.offset * HOT_FRACTION), stop.colour);
  }
  stops.forEach((stop) => {
    gradient.addColorStop(below(stop.offset * HOT_FRACTION), stop.colour);
  });
  gradient.addColorStop(below(HOT_FRACTION), zones.hot);
  gradient.addColorStop(below(OVER_FRACTION), zones.hot);
  gradient.addColorStop(below(OVER_FRACTION), zones.over);
  gradient.addColorStop(below(1), zones.over);
  return gradient;
};

/** Lamp counts: the scale beside a ladder snaps its marks to its lamps. */
export const SEGMENT_ROWS = 30;
export const STACK_ROWS = 22;
export const ledRows = (height: number) =>
  Math.max(6, Math.min(16, Math.floor(height / 14)));

export const ladderRows = (
  style: MeterStyle,
  height: number,
): number | undefined => {
  if (style === 'segments') {
    return SEGMENT_ROWS;
  }
  if (style === 'stack') {
    return STACK_ROWS;
  }
  if (style === 'leds') {
    return ledRows(height);
  }
  return undefined;
};

/**
 * Where a drawing lands on the screen's own pixels.
 *
 * The canvas is scaled to CSS pixels, so a rectangle at x = 20.4 lands
 * across two device pixels and its edge comes out as a soft grey column —
 * the opposite of a sharp border. Every edge below goes through `px`, and
 * `hair` is one device pixel, the thinnest line that is still crisp.
 */
export interface IMeterPen {
  context: CanvasRenderingContext2D;
  px: (value: number) => number;
  hair: number;
  /** The clock, for the styles whose drawing moves on its own. */
  now: number;
  /** The colours this frame is drawn in, as this window can show them. */
  inks: IMeterInks;
}

export const createPen = (
  context: CanvasRenderingContext2D,
  ratio: number,
  now: number,
  inks: IMeterInks,
): IMeterPen => ({
  context,
  px: (value) => Math.round(value * ratio) / ratio,
  hair: 1 / ratio,
  now,
  inks,
});

/**
 * A rectangle between two edges already on device pixels, never narrower
 * than one of them: a 0.4px sliver is drawn as a faint smear.
 */
export const fillBetween = (
  pen: IMeterPen,
  left: number,
  top: number,
  right: number,
  bottom: number,
) => {
  const width = Math.max(pen.hair, pen.px(right) - pen.px(left));
  const height = Math.max(pen.hair, pen.px(bottom) - pen.px(top));
  pen.context.fillRect(pen.px(left), pen.px(top), width, height);
};

/** The inside of a strip's border, where every style draws its reading. */
export const innerOf = (pen: IMeterPen, rect: IChannelRect): IChannelRect => {
  const left = pen.px(rect.x) + pen.hair;
  const top = pen.px(rect.y) + pen.hair;
  const right = pen.px(rect.x + rect.width) - pen.hair;
  const bottom = pen.px(rect.y + rect.height) - pen.hair;
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};
