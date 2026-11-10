/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The atlas JSON a sprite tool writes beside its sheet, read into frames
 * and the animations made of them: TexturePacker's and Phaser's "hash" (an
 * object of frames by name) and "array" (a list), Phaser 3's multi-atlas
 * (its first texture), and Aseprite's export, whose frames carry a duration
 * and whose tags name the animations.
 *
 * A frame trimmed of its empty border keeps where it sat on its original
 * canvas (`spriteSourceSize` inside `sourceSize`), and one stored turned a
 * quarter clockwise says so (`rotated`): both are put back when the frames
 * are laid into the scene's even grid, or a walk cycle would jitter and
 * lie on its side.
 */

export interface IAtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IAtlasFrame {
  name: string;
  /** Where it is in the sheet, as stored (turned, when `rotated`). */
  frame: IAtlasRect;
  rotated: boolean;
  /** Where it sits on its original canvas. */
  placed: IAtlasRect;
  /** Its original canvas. */
  source: { w: number; h: number };
  /** Milliseconds it is shown, when the file says. */
  duration?: number;
}

export interface IAtlasAnimation {
  /** Its tag or the frames' shared name; empty for the only one. */
  name: string;
  /** Frames in playing order, as indexes into `frames`. */
  order: number[];
}

export interface IAtlas {
  frames: IAtlasFrame[];
  animations: IAtlasAnimation[];
  /** The picture the atlas names, to say when another was chosen. */
  image?: string;
}

/** An atlas past this many frames is not one animation's. */
export const MAX_ATLAS_FRAMES = 4096;

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const whole = (value: unknown, least: number): number | undefined =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= least &&
  value <= 1_000_000
    ? value
    : undefined;

const rectOf = (value: unknown, least: number): IAtlasRect | undefined => {
  const raw = record(value);
  if (!raw) {
    return undefined;
  }
  const x = whole(raw.x, 0);
  const y = whole(raw.y, 0);
  const w = whole(raw.w, least);
  const h = whole(raw.h, least);
  return x === undefined ||
    y === undefined ||
    w === undefined ||
    h === undefined
    ? undefined
    : { x, y, w, h };
};

/** One frame's entry, or nothing when it cannot be placed. */
const frameOf = (name: string, value: unknown): IAtlasFrame | undefined => {
  const raw = record(value);
  const frame = rectOf(raw?.frame, 1);
  if (!raw || !frame) {
    return undefined;
  }
  const rotated = raw.rotated === true;
  // Stored turned, the frame's rectangle in the sheet is its height wide.
  const upright = rotated
    ? { w: frame.h, h: frame.w }
    : { w: frame.w, h: frame.h };
  const sourceRaw = record(raw.sourceSize);
  const sourceW = whole(sourceRaw?.w, 1);
  const sourceH = whole(sourceRaw?.h, 1);
  const source =
    sourceW !== undefined && sourceH !== undefined
      ? { w: sourceW, h: sourceH }
      : upright;
  const placedRaw = rectOf(raw.spriteSourceSize, 1);
  const placed =
    placedRaw &&
    placedRaw.x + placedRaw.w <= source.w &&
    placedRaw.y + placedRaw.h <= source.h
      ? placedRaw
      : { x: 0, y: 0, w: upright.w, h: upright.h };
  const duration = whole(raw.duration, 1);
  return {
    name,
    frame,
    rotated,
    placed,
    source,
    ...(duration === undefined ? {} : { duration }),
  };
};

/** The frames list of a hash, an array, or a multi-atlas's first texture. */
const framesOf = (json: Record<string, unknown>): IAtlasFrame[] | undefined => {
  const textures = Array.isArray(json.textures) ? json.textures : undefined;
  const list = textures ? record(textures[0])?.frames : json.frames;
  if (Array.isArray(list)) {
    if (list.length > MAX_ATLAS_FRAMES) {
      return undefined;
    }
    return list.flatMap((entry, index) => {
      const name = record(entry)?.filename;
      const frame = frameOf(
        typeof name === 'string' ? name : String(index),
        entry,
      );
      return frame ? [frame] : [];
    });
  }
  const hash = record(list);
  if (!hash) {
    return undefined;
  }
  const entries = Object.entries(hash);
  if (entries.length > MAX_ATLAS_FRAMES) {
    return undefined;
  }
  return entries.flatMap(([name, entry]) => {
    const frame = frameOf(name, entry);
    return frame ? [frame] : [];
  });
};

/**
 * A tag's frames in Aseprite's playing order, its direction as the JSON
 * export names it (the .ase file's numbers are read into these names).
 */
export const tagOrder = (
  from: number,
  to: number,
  direction: unknown,
): number[] => {
  const forward = Array.from({ length: to - from + 1 }, (_, at) => from + at);
  const back = [...forward].reverse();
  switch (direction) {
    case 'reverse':
      return back;
    // There and back, the ends not shown twice in a row when it loops.
    case 'pingpong':
      return [...forward, ...back.slice(1, -1)];
    case 'pingpong_reverse':
      return [...back, ...forward.slice(1, -1)];
    default:
      return forward;
  }
};

/** Aseprite's tags as animations; none when it has no usable tag. */
const taggedAnimations = (
  meta: Record<string, unknown> | undefined,
  count: number,
): IAtlasAnimation[] => {
  const tags = Array.isArray(meta?.frameTags) ? meta.frameTags : [];
  return tags.flatMap((tag) => {
    const raw = record(tag);
    const from = whole(raw?.from, 0);
    const to = whole(raw?.to, 0);
    const name = typeof raw?.name === 'string' ? raw.name : '';
    if (from === undefined || to === undefined || from > to || to >= count) {
      return [];
    }
    return [{ name, order: tagOrder(from, to, raw?.direction) }];
  });
};

/**
 * Frames named one stem and a number (walk_01.png, walk_02.png, run_01.png)
 * as one animation per stem, numbered in order; everything in one when the
 * names make no groups.
 */
const namedAnimations = (frames: IAtlasFrame[]): IAtlasAnimation[] => {
  const numbered = /^(.*?)[\s_.-]*(\d+)(?:\.[a-z0-9]+)?$/i;
  const groups = new Map<string, Array<{ index: number; number: number }>>();
  let grouped = true;
  frames.forEach(({ name }, index) => {
    const found = numbered.exec(name);
    if (!found) {
      grouped = false;
      return;
    }
    const stem = found[1].replace(/[\s_.-]+$/, '');
    const members = groups.get(stem) ?? [];
    members.push({ index, number: Number(found[2]) });
    groups.set(stem, members);
  });
  if (!grouped || groups.size < 2) {
    return [{ name: '', order: frames.map((_, index) => index) }];
  }
  return [...groups].map(([name, members]) => ({
    name,
    order: [...members]
      .sort((a, b) => a.number - b.number)
      .map(({ index }) => index),
  }));
};

/** The atlas the JSON describes, or nothing it can be read as. */
export const readAtlas = (text: string): IAtlas | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  const json = record(parsed);
  if (!json) {
    return undefined;
  }
  const frames = framesOf(json);
  if (!frames || frames.length === 0) {
    return undefined;
  }
  const meta = record(json.meta);
  const tagged = taggedAnimations(meta, frames.length);
  const image = typeof meta?.image === 'string' ? meta.image : undefined;
  return {
    frames,
    animations: tagged.length > 0 ? tagged : namedAnimations(frames),
    ...(image ? { image } : {}),
  };
};
