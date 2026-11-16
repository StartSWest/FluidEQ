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
 * How a viewer wants captions drawn over a film, and where (Ivan,
 * 2026-11-15: "with some sub colours and settings", "make sure we can place
 * subs on different parts, or even move them with the mouse"). One choice
 * for every film, kept per viewer; read back checked field by field, so a
 * value an older or newer build wrote falls back to its default alone and
 * never takes the rest with it.
 */

export const SUBTITLE_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type TSubtitleSize = (typeof SUBTITLE_SIZES)[number];

export const SUBTITLE_COLOURS = [
  'white',
  'yellow',
  'cyan',
  'green',
  'pink',
] as const;
export type TSubtitleColour = (typeof SUBTITLE_COLOURS)[number];

export const SUBTITLE_BACKGROUNDS = ['none', 'outline', 'box'] as const;
export type TSubtitleBackground = (typeof SUBTITLE_BACKGROUNDS)[number];

/** The box's opacities offered: four steps a viewer can tell apart. */
export const SUBTITLE_OPACITIES = [0.25, 0.5, 0.75, 1] as const;

/**
 * Each size as a share of the picture's height, so a caption is the same
 * size against the film in a small pane and in full screen. Medium is the
 * broadcast guideline's line, about a twentieth of the picture.
 */
export const SUBTITLE_SIZE_SCALE: Readonly<Record<TSubtitleSize, number>> = {
  s: 0.038,
  m: 0.048,
  l: 0.06,
  xl: 0.075,
};

/** The inks offered: the colours captions have always been drawn in, each
 * light enough to read over a dark frame with an outline under it. */
export const SUBTITLE_INK: Readonly<Record<TSubtitleColour, string>> = {
  white: '#ffffff',
  yellow: '#ffe45c',
  cyan: '#6fe7ff',
  green: '#8dff9a',
  pink: '#ff9ce0',
};

/** Where the caption box's centre is, as fractions of the picture: 0 is
 * the left or top edge, 1 the right or bottom. */
export interface ISubtitlePosition {
  x: number;
  y: number;
}

export interface ISubtitleStyle {
  enabled: boolean;
  size: TSubtitleSize;
  colour: TSubtitleColour;
  background: TSubtitleBackground;
  /** The box's opacity; the box alone has one. */
  opacity: number;
  position: ISubtitlePosition;
}

export const DEFAULT_SUBTITLE_STYLE: ISubtitleStyle = {
  enabled: true,
  size: 'm',
  colour: 'white',
  background: 'outline',
  opacity: 0.75,
  position: { x: 0.5, y: 1 },
};

/**
 * The nine places a caption can be put by name: top, middle and bottom,
 * each left, centre and right. An edge is 0 or 1, and the box is held
 * inside the picture by its own size when it is drawn
 * (`clampedCaptionCentre`), so "left" is flush with the left whatever the
 * line's length.
 */
export const SUBTITLE_ANCHORS = [
  'topLeft',
  'topCentre',
  'topRight',
  'middleLeft',
  'middleCentre',
  'middleRight',
  'bottomLeft',
  'bottomCentre',
  'bottomRight',
] as const;
export type TSubtitleAnchor = (typeof SUBTITLE_ANCHORS)[number];

const EDGES = [0, 0.5, 1] as const;

export const anchorPosition = (anchor: TSubtitleAnchor): ISubtitlePosition => {
  const at = SUBTITLE_ANCHORS.indexOf(anchor);
  return { x: EDGES[at % 3], y: EDGES[Math.floor(at / 3)] };
};

/** The anchor a position is exactly, or nothing for one dragged by hand. */
export const anchorOf = (
  position: ISubtitlePosition,
): TSubtitleAnchor | undefined =>
  SUBTITLE_ANCHORS.find((anchor) => {
    const place = anchorPosition(anchor);
    return place.x === position.x && place.y === position.y;
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => allowed.find((entry) => entry === value) ?? fallback;

const fraction = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

/**
 * A stored style, every field checked on its own. Nothing stored, or text
 * that is not a style, is the default.
 */
export const parseSubtitleStyle = (raw: string | null): ISubtitleStyle => {
  let stored: unknown;
  try {
    stored = raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    // Not JSON: somebody's hand edit, or another build's format.
    stored = undefined;
  }
  if (!isRecord(stored)) {
    return DEFAULT_SUBTITLE_STYLE;
  }
  const defaults = DEFAULT_SUBTITLE_STYLE;
  const position = isRecord(stored.position) ? stored.position : {};
  const opacity = SUBTITLE_OPACITIES.find(
    (allowed) => allowed === stored.opacity,
  );
  return {
    enabled:
      typeof stored.enabled === 'boolean' ? stored.enabled : defaults.enabled,
    size: oneOf(stored.size, SUBTITLE_SIZES, defaults.size),
    colour: oneOf(stored.colour, SUBTITLE_COLOURS, defaults.colour),
    background: oneOf(
      stored.background,
      SUBTITLE_BACKGROUNDS,
      defaults.background,
    ),
    opacity: opacity ?? defaults.opacity,
    position: {
      x: fraction(position.x, defaults.position.x),
      y: fraction(position.y, defaults.position.y),
    },
  };
};

export interface ISize {
  width: number;
  height: number;
}

/**
 * Where the caption box's centre lands, in pixels of the room it is drawn
 * in, for a position and the box's own measured size: as asked, but never
 * so near an edge that any of the box leaves the room or comes closer than
 * `margin` to its edge. A box wider than the room is centred in it.
 */
export const clampedCaptionCentre = (
  position: ISubtitlePosition,
  room: ISize,
  box: ISize,
  margin: number,
): { left: number; top: number } => {
  const along = (share: number, length: number, size: number) => {
    const lowest = size / 2 + margin;
    const highest = length - size / 2 - margin;
    return lowest > highest
      ? length / 2
      : Math.min(highest, Math.max(lowest, share * length));
  };
  return {
    left: along(position.x, room.width, box.width),
    top: along(position.y, room.height, box.height),
  };
};

/**
 * Where the picture itself is inside a `<video>` drawn `object-fit:
 * contain`: the whole box less its letterbox, centred across, and either
 * centred down or hung from the top (`alignTop`, the Library tab's
 * `object-position: center top`). The whole box while the film's own size
 * is not known yet. Captions stand on the picture, never on the bands.
 */
export const containedPicture = (
  box: ISize,
  media: ISize,
  alignTop: boolean,
): { left: number; top: number; width: number; height: number } => {
  if (media.width <= 0 || media.height <= 0) {
    return { left: 0, top: 0, width: box.width, height: box.height };
  }
  // The side that fills is the box's own length, not a product that lands
  // a hair beside it, so a letterbox of none is exactly none.
  const isWide = box.width * media.height <= box.height * media.width;
  const width = isWide ? box.width : (box.height * media.width) / media.height;
  const height = isWide ? (box.width * media.height) / media.width : box.height;
  return {
    left: (box.width - width) / 2,
    top: alignTop ? 0 : (box.height - height) / 2,
    width,
    height,
  };
};

/**
 * A point the box was dragged to, as the position kept: its centre held
 * inside the room the same way, then said as fractions of the room, so the
 * caption stands at the same place in the picture at any size.
 */
export const positionFromPoint = (
  point: { left: number; top: number },
  room: ISize,
  box: ISize,
  margin: number,
): ISubtitlePosition => {
  if (room.width <= 0 || room.height <= 0) {
    return DEFAULT_SUBTITLE_STYLE.position;
  }
  const centre = clampedCaptionCentre(
    { x: point.left / room.width, y: point.top / room.height },
    room,
    box,
    margin,
  );
  return { x: centre.left / room.width, y: centre.top / room.height };
};
