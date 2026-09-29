/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a visualizer throws from the viewer's hand (Ivan, 2026-09-28: "mouse
 * can show sparks and things, whatever is built for the scene"; "the flying
 * petals I want that too"): a trail as the mouse crosses it and a burst where
 * it is tapped - a flower's petals, a fire's sparks, a winter scene's snow -
 * drawn by FluidEQ over the scene, only while the listener lets it answer the
 * mouse.
 *
 * DATA, NEVER CODE, like the elements in the window (`sceneAmbient.ts`),
 * which an emitter may name to throw one of them - its shape, its outline or
 * its picture, and its colours. Everything is clamped on the way in, and the
 * engine holds every scene to one ceiling of live pieces
 * (`MAX_POINTER_PIECES`), so no scene can bury its own picture.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno as
 * it is, so what the server signs and what the app plays are the same bytes.
 * The server's deploy flattens every module into one file, so a helper here
 * takes a name no other vendored module uses.
 */

/** The shapes an emitter draws itself; a scene's own come by `element`. */
export const POINTER_SHAPES = [
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
  'bird',
] as const;
export type TPointerShape = (typeof POINTER_SHAPES)[number];

/** When an emitter throws: as the hand moves, or where it taps. */
export const POINTER_TRIGGERS = ['move', 'tap'] as const;
export type TPointerTrigger = (typeof POINTER_TRIGGERS)[number];

export const MAX_POINTER_EMITTERS = 3;
/** Pieces alive at once, across every emitter: the whole budget. */
export const MAX_POINTER_PIECES = 90;
/** On a move, pieces for every 100 pixels the hand travels, at most. */
export const MAX_POINTER_TRAIL = 8;
/** On a tap, pieces thrown at once, at most. */
export const MAX_POINTER_BURST = 24;
export const MIN_POINTER_SIZE = 4;
export const MAX_POINTER_SIZE = 48;
/** Seconds a piece lives. */
export const MIN_POINTER_LIFE = 0.2;
export const MAX_POINTER_LIFE = 3;
export const MAX_POINTER_COLOURS = 3;

export interface IScenePointerEmitter {
  on: TPointerTrigger;
  /** A built-in shape; absent when `element` names one of the scene's. */
  shape?: TPointerShape;
  /** One of the scene's elements in the window, by id. */
  element?: string;
  /** Empty: the element's own colours, or white. */
  colours: string[];
  /** Per 100 px moved (`move`), or all at once (`tap`). */
  amount: number;
  /** Smallest and largest, in CSS pixels. */
  size: readonly [number, number];
  /** Seconds each piece lives. */
  life: number;
  /** 0..1: how fast a piece leaves the hand. */
  speed: number;
  /** 0..1: straight away from the hand's path (0) to every way round (1). */
  spread: number;
  /** -1..1: how hard a piece rises (below 0) or falls (above 0) as it goes. */
  gravity: number;
  /** 0..1: how much each piece turns as it flies. */
  spin: number;
}

export interface IScenePointer {
  emitters: IScenePointerEmitter[];
}

const POINTER_COLOUR = /^#[0-9a-f]{6}$/i;
const POINTER_ELEMENT_ID = /^[a-z][a-z0-9_]{0,23}$/;

const isPointerRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clampTo = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const oneOfList = <T extends string>(
  list: readonly T[],
  value: unknown,
): T | undefined =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

const readEmitter = (
  raw: unknown,
  elementIds: ReadonlySet<string>,
): IScenePointerEmitter | undefined => {
  if (!isPointerRecord(raw)) {
    return undefined;
  }
  const on = oneOfList(POINTER_TRIGGERS, raw.on);
  const shape = oneOfList(POINTER_SHAPES, raw.shape);
  // An element the scene does not have is nothing to throw.
  const element =
    typeof raw.element === 'string' &&
    POINTER_ELEMENT_ID.test(raw.element) &&
    elementIds.has(raw.element)
      ? raw.element
      : undefined;
  if (!on || (!shape && !element)) {
    return undefined;
  }
  const colours = Array.isArray(raw.colours)
    ? raw.colours
        .filter(
          (colour): colour is string =>
            typeof colour === 'string' && POINTER_COLOUR.test(colour),
        )
        .slice(0, MAX_POINTER_COLOURS)
    : [];
  const size = Array.isArray(raw.size) ? raw.size : [];
  const small = clampTo(size[0], MIN_POINTER_SIZE, MAX_POINTER_SIZE, 10);
  const large = clampTo(size[1], MIN_POINTER_SIZE, MAX_POINTER_SIZE, small);
  return {
    on,
    ...(element ? { element } : { shape }),
    colours,
    amount: clampTo(
      raw.amount,
      1,
      on === 'tap' ? MAX_POINTER_BURST : MAX_POINTER_TRAIL,
      on === 'tap' ? 8 : 2,
    ),
    size: [Math.min(small, large), Math.max(small, large)],
    life: clampTo(raw.life, MIN_POINTER_LIFE, MAX_POINTER_LIFE, 1),
    speed: clampTo(raw.speed, 0, 1, 0.4),
    spread: clampTo(raw.spread, 0, 1, 0.5),
    gravity: clampTo(raw.gravity, -1, 1, 0),
    spin: clampTo(raw.spin, 0, 1, 0.3),
  };
};

/**
 * `pack.json`'s `pointer`, kept in range rather than refused. `elementIds`
 * are the scene's elements in the window, which an emitter may throw.
 * Nothing usable is no pointer at all: the scene plays as it did.
 */
export const readScenePointer = (
  raw: unknown,
  elementIds: readonly string[] = [],
): IScenePointer | undefined => {
  if (!isPointerRecord(raw) || !Array.isArray(raw.emitters)) {
    return undefined;
  }
  const ids = new Set(elementIds);
  const emitters = raw.emitters
    .slice(0, MAX_POINTER_EMITTERS)
    .map((emitter) => readEmitter(emitter, ids))
    .filter(
      (emitter): emitter is IScenePointerEmitter => emitter !== undefined,
    );
  return emitters.length > 0 ? { emitters } : undefined;
};
