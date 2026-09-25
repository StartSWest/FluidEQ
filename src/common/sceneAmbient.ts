/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A visualizer's elements in the window around it: the birds of a mountain
 * scene crossing the app, a flower scene's petals wandering behind the panes,
 * a city's stars — drawn faintly over the whole window while the window takes
 * the scene's Ambient mode.
 *
 * DATA, NEVER CODE. A scene's shader runs on the GPU inside rules that bound
 * it (`memberSceneRules.ts`); this part runs in the window itself, among the
 * member's controls, so it can say what to draw and how it moves and nothing
 * else: a shape from a fixed list, an outline of plain path numbers, or poses
 * cut from the scene's own signed artwork by four numbers each; colours,
 * counts, sizes, one of a few motions, and what in the music it answers.
 * Everything is clamped on the way in, and the engine that plays it
 * (`renderer/ambient`) holds the result to a ceiling of its own, so no scene
 * can crowd the window, flash it or cover the controls.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno as
 * it is, so what the server signs and what the app plays are the same bytes.
 */

export const AMBIENT_SHAPES = [
  'bird',
  'petal',
  'blossom',
  'leaf',
  'star',
  'spark',
  'bokeh',
  'firefly',
  'bubble',
  'snow',
  'gem',
  'path',
  'picture',
] as const;
export type TAmbientShape = (typeof AMBIENT_SHAPES)[number];

/** Which way a picture looks, so one that travels can turn to face its way. */
export const AMBIENT_FACINGS = ['none', 'right', 'left'] as const;
export type TAmbientFacing = (typeof AMBIENT_FACINGS)[number];

export const AMBIENT_MOTIONS = [
  'fly',
  'drift',
  'wander',
  'twinkle',
  'fall',
  'rise',
  'sway',
] as const;
export type TAmbientMotion = (typeof AMBIENT_MOTIONS)[number];

export const AMBIENT_AREAS = [
  'all',
  'top',
  'bottom',
  'left',
  'right',
  'edges',
] as const;
export type TAmbientArea = (typeof AMBIENT_AREAS)[number];

export const AMBIENT_MUSIC = [
  'none',
  'level',
  'bass',
  'mid',
  'treble',
  'beat',
] as const;
export type TAmbientMusic = (typeof AMBIENT_MUSIC)[number];

/** What a control of the ambient layer may move. */
export const AMBIENT_FIELDS = [
  'count',
  'size',
  'opacity',
  'speed',
  'flap',
  'turn',
  'react',
] as const;
export type TAmbientField = (typeof AMBIENT_FIELDS)[number];

export const MAX_AMBIENT_ELEMENTS = 4;
export const MAX_AMBIENT_COUNT = 16;

/**
 * The most any element shows over the window, whatever its `opacity` asks
 * for. Screened over the app (`SceneAmbient.scss`) this lifts a dark pane by
 * a sixth at the very most — a shape seen from the corner of the eye, never
 * one that covers a word. Applied in `ambientField.ts` and quoted to the
 * member's AI in `aiPrompt.ts`, which is why it lives here: these elements
 * float over FluidEQ's own buttons, sliders and text, and a scene that could
 * darken them would make the app unusable while it plays.
 */
export const AMBIENT_CEILING = 0.42;

/**
 * What an element's own `opacity` is worth asking for, as the prompt puts it
 * to the member's AI. Anything above the top of this is not stronger — the
 * ceiling above holds it — it only spends the scene's whole allowance on one
 * element, and anything under the bottom is invisible on a bright desktop.
 */
export const AMBIENT_OPACITY_ADVISED: readonly [number, number] = [0.2, 0.7];
/** Across every element: past this, counts are brought down in proportion. */
export const MAX_AMBIENT_TOTAL = 40;
export const MIN_AMBIENT_SIZE = 4;
export const MAX_AMBIENT_SIZE = 64;
export const MAX_AMBIENT_PARAMS = 5;
export const MAX_AMBIENT_COLOURS = 3;
export const MAX_AMBIENT_PATH_LENGTH = 480;
/** How far from the middle an outline's numbers may reach, in its own box. */
const MAX_PATH_REACH = 2;
export const MAX_AMBIENT_FRAMES = 8;
/**
 * A pose's sides, in artwork pixels. The engine never draws one larger than
 * `MAX_AMBIENT_SIZE`, so a bigger cut would only be decoded to be shrunk.
 */
export const MIN_AMBIENT_FRAME_EDGE = 8;
export const MAX_AMBIENT_FRAME_EDGE = 512;

/** A place in the scene's artwork: x, y, width, height from its top-left. */
export type TAmbientFrame = readonly [number, number, number, number];

/** The scene's artwork, as far as a picture needs to know it. */
export interface IAmbientArtworkSize {
  width: number;
  height: number;
}

export interface IAmbientElement {
  id: string;
  shape: TAmbientShape;
  /** Only for `path`: an outline in a box from -1 to 1 on each axis. */
  path?: string;
  /**
   * Only for `picture`: its poses, as places of one size inside the scene's
   * artwork, played in order — a bird's wingbeat, a lantern's flicker.
   */
  frames?: readonly TAmbientFrame[];
  /** Only for `picture`: the pose it holds while gliding, by its index. */
  rest?: number;
  /** Only for `picture`: which way it looks in its artwork. */
  facing?: TAmbientFacing;
  /** Empty only for a `picture`, which is drawn in its own colours. */
  colours: string[];
  count: number;
  /** Smallest and largest, in CSS pixels. */
  size: readonly [number, number];
  /** 0..1, of the most the engine lets any element show. */
  opacity: number;
  motion: TAmbientMotion;
  /** 0..1, of the motion's own range. */
  speed: number;
  area: TAmbientArea;
  /** 0..1: how hard wings beat, petals flutter or stars twinkle. */
  flap: number;
  /** 0..1: how much each one turns, sways and differs from the others. */
  turn: number;
  music: TAmbientMusic;
  /** 0..1: how strongly it brightens and swells with `music`. */
  react: number;
}

export interface IAmbientTarget {
  /** An element's id. */
  element: string;
  field: TAmbientField;
  /** What the field is with the control at 0 and at 1. */
  min: number;
  max: number;
}

export interface IAmbientParam {
  id: string;
  names: Record<string, string> & { en: string };
  /** 0..1: where the control stands. */
  value: number;
  targets: IAmbientTarget[];
}

export interface ISceneAmbient {
  elements: IAmbientElement[];
  params: IAmbientParam[];
}

const ELEMENT_ID = /^[a-z][a-z0-9_]{0,23}$/;
const PARAM_ID = /^[a-z][a-z0-9_]{0,23}$/;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const LOCALE = /^[a-z]{2}$/;
const MAX_NAME = 40;
/** Only commands and numbers: an outline, and nothing that could be anything else. */
const PATH_TEXT = /^[MmLlHhVvCcSsQqTtZz0-9eE.,+\-\s]*$/;
const PATH_COMMAND = /[MmLlHhVvCcSsQqTtZz]/g;
const PATH_NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const MAX_PATH_COMMANDS = 64;

const isAmbientRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const numberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const unit = (value: unknown, fallback: number) =>
  clamp(numberOr(value, fallback), 0, 1);

const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
  fallback?: T,
): T | undefined =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/** Control, zero-width and bidirectional characters, built from code points. */
const INVISIBLE = new RegExp(
  `[${[
    [0x00, 0x1f],
    [0x7f, 0x9f],
    [0xad, 0xad],
    [0x200b, 0x200f],
    [0x2028, 0x202e],
    [0x2060, 0x206f],
    [0xfeff, 0xfeff],
  ]
    .map(
      ([from, to]) =>
        `\\u${from.toString(16).padStart(4, '0')}-\\u${to
          .toString(16)
          .padStart(4, '0')}`,
    )
    .join('')}]`,
  'g',
);

const cleanName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const cleaned = value
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned && cleaned.length <= MAX_NAME ? cleaned : undefined;
};

/**
 * An outline the engine may draw, or undefined. Commands and numbers only,
 * a bounded number of each, and every number within the outline's box, so an
 * outline cannot be a picture of anything larger than the element it is.
 */
export const readAmbientPath = (value: unknown): string | undefined => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_AMBIENT_PATH_LENGTH ||
    !PATH_TEXT.test(value) ||
    !/^\s*[Mm]/.test(value)
  ) {
    return undefined;
  }
  const commands = value.match(PATH_COMMAND)?.length ?? 0;
  const numbers = value.match(PATH_NUMBER) ?? [];
  if (
    commands === 0 ||
    commands > MAX_PATH_COMMANDS ||
    numbers.some((text) => !(Math.abs(Number(text)) <= MAX_PATH_REACH))
  ) {
    return undefined;
  }
  return value.trim();
};

const readSize = (value: unknown): readonly [number, number] => {
  const pair = Array.isArray(value) ? value : [value, value];
  const small = clamp(
    numberOr(pair[0], 16),
    MIN_AMBIENT_SIZE,
    MAX_AMBIENT_SIZE,
  );
  const large = clamp(
    numberOr(pair[1], small),
    MIN_AMBIENT_SIZE,
    MAX_AMBIENT_SIZE,
  );
  return [Math.min(small, large), Math.max(small, large)];
};

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/**
 * A picture's poses, or undefined. Whole pixels, one size for every pose so
 * the animation cannot jump in scale, and every one inside the artwork the
 * pack carries: a place outside it would sample nothing, and a scene with no
 * artwork has nothing to cut a picture from.
 */
export const readAmbientFrames = (
  value: unknown,
  artwork: IAmbientArtworkSize | undefined,
): TAmbientFrame[] | undefined => {
  if (
    !artwork ||
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AMBIENT_FRAMES
  ) {
    return undefined;
  }
  const first = value[0];
  const fits = (frame: unknown): frame is TAmbientFrame => {
    if (!Array.isArray(frame) || frame.length !== 4 || !frame.every(isWhole)) {
      return false;
    }
    const [x, y, width, height] = frame as number[];
    return (
      x >= 0 &&
      y >= 0 &&
      width >= MIN_AMBIENT_FRAME_EDGE &&
      height >= MIN_AMBIENT_FRAME_EDGE &&
      width <= MAX_AMBIENT_FRAME_EDGE &&
      height <= MAX_AMBIENT_FRAME_EDGE &&
      x + width <= artwork.width &&
      y + height <= artwork.height &&
      width === (first as number[])[2] &&
      height === (first as number[])[3]
    );
  };
  return value.every(fits)
    ? value.map(([x, y, width, height]) => [x, y, width, height])
    : undefined;
};

/** The pose a picture holds while gliding: undefined for none, -1 for a bad one. */
const readRest = (value: unknown, frames: readonly TAmbientFrame[]) => {
  if (value === undefined) {
    return undefined;
  }
  return isWhole(value) && value >= 0 && value < frames.length ? value : -1;
};

const readElement = (
  value: unknown,
  artwork: IAmbientArtworkSize | undefined,
): IAmbientElement | undefined => {
  if (!isAmbientRecord(value)) {
    return undefined;
  }
  const id = typeof value.id === 'string' ? value.id : '';
  const shape = oneOf(AMBIENT_SHAPES, value.shape);
  const motion = oneOf(AMBIENT_MOTIONS, value.motion);
  const colours = Array.isArray(value.colours)
    ? value.colours
        .filter(
          (colour): colour is string =>
            typeof colour === 'string' && HEX_COLOUR.test(colour),
        )
        .slice(0, MAX_AMBIENT_COLOURS)
        .map((colour) => colour.toLowerCase())
    : [];
  const path = shape === 'path' ? readAmbientPath(value.path) : undefined;
  const frames =
    shape === 'picture' ? readAmbientFrames(value.frames, artwork) : undefined;
  const rest = frames ? readRest(value.rest, frames) : undefined;
  const facing =
    shape === 'picture'
      ? oneOf(AMBIENT_FACINGS, value.facing, 'none')
      : undefined;
  if (
    !ELEMENT_ID.test(id) ||
    !shape ||
    !motion ||
    (colours.length === 0 && shape !== 'picture') ||
    (shape === 'path' && !path) ||
    (shape === 'picture' && (!frames || rest === -1 || !facing))
  ) {
    return undefined;
  }
  return {
    id,
    shape,
    ...(path ? { path } : {}),
    ...(frames ? { frames } : {}),
    ...(rest === undefined ? {} : { rest }),
    ...(facing ? { facing } : {}),
    colours,
    count: Math.round(clamp(numberOr(value.count, 6), 1, MAX_AMBIENT_COUNT)),
    size: readSize(value.size),
    opacity: unit(value.opacity, 0.6),
    motion,
    speed: unit(value.speed, 0.4),
    area: oneOf(AMBIENT_AREAS, value.area, 'all') ?? 'all',
    flap: unit(value.flap, 0.5),
    turn: unit(value.turn, 0.4),
    music: oneOf(AMBIENT_MUSIC, value.music, 'none') ?? 'none',
    react: unit(value.react, 0.3),
  };
};

/** The bounds a field is held to, whatever a control asks of it. */
const FIELD_BOUNDS: Record<TAmbientField, readonly [number, number]> = {
  count: [1, MAX_AMBIENT_COUNT],
  size: [MIN_AMBIENT_SIZE, MAX_AMBIENT_SIZE],
  opacity: [0, 1],
  speed: [0, 1],
  flap: [0, 1],
  turn: [0, 1],
  react: [0, 1],
};

const readTarget = (
  value: unknown,
  elementIds: ReadonlySet<string>,
): IAmbientTarget | undefined => {
  if (!isAmbientRecord(value) || typeof value.element !== 'string') {
    return undefined;
  }
  const field = oneOf(AMBIENT_FIELDS, value.field);
  if (!field || !elementIds.has(value.element)) {
    return undefined;
  }
  const [low, high] = FIELD_BOUNDS[field];
  return {
    element: value.element,
    field,
    min: clamp(numberOr(value.min, low), low, high),
    max: clamp(numberOr(value.max, high), low, high),
  };
};

const readParam = (
  value: unknown,
  elementIds: ReadonlySet<string>,
): IAmbientParam | undefined => {
  if (
    !isAmbientRecord(value) ||
    typeof value.id !== 'string' ||
    !PARAM_ID.test(value.id) ||
    !isAmbientRecord(value.names)
  ) {
    return undefined;
  }
  const names: Record<string, string> = {};
  Object.entries(value.names).forEach(([locale, name]) => {
    const cleaned = cleanName(name);
    if (LOCALE.test(locale) && cleaned) {
      names[locale] = cleaned;
    }
  });
  const targets = Array.isArray(value.targets)
    ? value.targets
        .map((target) => readTarget(target, elementIds))
        .filter((target): target is IAmbientTarget => target !== undefined)
        .slice(0, MAX_AMBIENT_ELEMENTS * AMBIENT_FIELDS.length)
    : [];
  if (!names.en || targets.length === 0) {
    return undefined;
  }
  return {
    id: value.id,
    names: names as IAmbientParam['names'],
    value: unit(value.value, 0.5),
    targets,
  };
};

/**
 * The ambient layer a pack describes, or undefined when it describes none
 * that can be drawn. Never refuses the pack around it: a scene with a broken
 * ambient layer still plays, without the layer. `artwork` is the pack's own,
 * already verified: pictures are cut from it and from nothing else.
 */
export const normalizeSceneAmbient = (
  raw: unknown,
  artwork?: IAmbientArtworkSize,
): ISceneAmbient | undefined => {
  if (!isAmbientRecord(raw) || !Array.isArray(raw.elements)) {
    return undefined;
  }
  const seen = new Set<string>();
  const elements = raw.elements
    .map((element) => readElement(element, artwork))
    .filter((element): element is IAmbientElement => {
      if (!element || seen.has(element.id)) {
        return false;
      }
      seen.add(element.id);
      return true;
    })
    .slice(0, MAX_AMBIENT_ELEMENTS);
  if (elements.length === 0) {
    return undefined;
  }
  // Too many altogether: every element keeps its share, at least one each.
  const total = elements.reduce((sum, element) => sum + element.count, 0);
  const fitted =
    total > MAX_AMBIENT_TOTAL
      ? elements.map((element) => ({
          ...element,
          count: Math.max(
            1,
            Math.floor((element.count * MAX_AMBIENT_TOTAL) / total),
          ),
        }))
      : elements;
  const ids = new Set(fitted.map((element) => element.id));
  const paramIds = new Set<string>();
  const params = (Array.isArray(raw.params) ? raw.params : [])
    .map((param) => readParam(param, ids))
    .filter((param): param is IAmbientParam => {
      if (!param || paramIds.has(param.id)) {
        return false;
      }
      paramIds.add(param.id);
      return true;
    })
    .slice(0, MAX_AMBIENT_PARAMS);
  return { elements: fitted, params };
};

/**
 * Whether `raw` came through whole: every element and control it wrote kept,
 * nothing over the limits. The Studio says so when it did not, so the member
 * learns the birds they asked for were dropped rather than wondering where
 * they went; a scene out in the world just plays what survived.
 */
export const isWholeSceneAmbient = (
  raw: unknown,
  artwork?: IAmbientArtworkSize,
): boolean => {
  if (raw === undefined) {
    return true;
  }
  const ambient = normalizeSceneAmbient(raw, artwork);
  if (!ambient || !isAmbientRecord(raw) || !Array.isArray(raw.elements)) {
    return false;
  }
  const rawParams = Array.isArray(raw.params) ? raw.params : [];
  const rawTotal = raw.elements.reduce<number>(
    (sum, element) =>
      sum + (isAmbientRecord(element) ? numberOr(element.count, 6) : 0),
    0,
  );
  return (
    ambient.elements.length === raw.elements.length &&
    ambient.params.length === rawParams.length &&
    rawTotal <= MAX_AMBIENT_TOTAL &&
    ambient.params.every(
      (param, index) =>
        param.targets.length ===
        (isAmbientRecord(rawParams[index]) &&
        Array.isArray((rawParams[index] as Record<string, unknown>).targets)
          ? ((rawParams[index] as Record<string, unknown>).targets as unknown[])
              .length
          : 0),
    )
  );
};

/**
 * The elements as the controls set them: each target's field placed between
 * its `min` and `max` by where its control stands, and held to the field's
 * bounds. `values` are the controls' positions, by id, over the pack's own.
 */
export const ambientElementsAt = (
  ambient: ISceneAmbient,
  values: Readonly<Record<string, number>> = {},
): IAmbientElement[] =>
  ambient.elements.map((element) => {
    let next: IAmbientElement = element;
    ambient.params.forEach((param) => {
      const position = clamp(numberOr(values[param.id], param.value), 0, 1);
      param.targets
        .filter((target) => target.element === element.id)
        .forEach((target) => {
          const [low, high] = FIELD_BOUNDS[target.field];
          const at = clamp(
            target.min + (target.max - target.min) * position,
            low,
            high,
          );
          if (target.field === 'size') {
            // The largest follows the control; the smallest keeps its share.
            const share = next.size[0] / next.size[1];
            next = { ...next, size: [Math.max(low, at * share), at] };
          } else if (target.field === 'count') {
            next = { ...next, count: Math.round(at) };
          } else {
            next = { ...next, [target.field]: at };
          }
        });
    });
    return next;
  });
