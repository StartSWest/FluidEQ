/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What main and `FluidEQ-Scenes.exe` say to each other: the twin of
 * `native/scene-host/src/scene_wire.h`, which lays every message out. A
 * magic word, the message's kind and its length, then the message,
 * little-endian. `lampWireFixture.ts` writes messages from here into the
 * header `lamp_messages_test.cpp` reads, and the bytes the host writes into
 * the reference this reader is tested against, so the two ends are held to
 * one layout.
 */

export const SCENE_HOST_MAGIC = 0x484e4353; // "SCNH"
const HEADER_BYTES = 12;
/** No message is larger: a 6 MB artwork and its scene. */
const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024;

export const SCENE_HOST_KIND = {
  show: 1,
  daylight: 2,
  pause: 3,
  profile: 4,
  accent: 5,
  preview: 6,
  grid: 101,
  picture: 102,
  loaded: 103,
  failed: 104,
} as const;

export const DAYLIGHT_MODE = { fixed: 1, clock: 2 } as const;

/** `TLightingWorkerReply`'s reasons, numbered as the host sends them. */
export const SCENE_HOST_FAILURES = [
  'no-context',
  'compile',
  'no-guard',
  'too-heavy',
  'artwork',
  'gpu-reset',
  'lost',
] as const;
export type TSceneHostFailure =
  (typeof SCENE_HOST_FAILURES)[number] | 'unknown';

export interface IMessageWriter {
  u32(value: number): IMessageWriter;
  f64(value: number): IMessageWriter;
  raw(bytes: Uint8Array): IMessageWriter;
  text(value: string): IMessageWriter;
  /** The whole message, header first. */
  finish(): Uint8Array;
}

/** Appends little-endian values to a message of `kind`, growing as it goes. */
/** One message of `kind`, its payload written field by field. */
export const messageWriter = (kind: number): IMessageWriter => {
  let bytes = new Uint8Array(256);
  let view = new DataView(bytes.buffer);
  let at = HEADER_BYTES;
  const room = (size: number) => {
    if (at + size <= bytes.length) {
      return;
    }
    let length = bytes.length * 2;
    while (length < at + size) {
      length *= 2;
    }
    const grown = new Uint8Array(length);
    grown.set(bytes.subarray(0, at));
    bytes = grown;
    view = new DataView(grown.buffer);
  };
  const writer: IMessageWriter = {
    u32: (value) => {
      room(4);
      view.setUint32(at, value, true);
      at += 4;
      return writer;
    },
    f64: (value) => {
      room(8);
      view.setFloat64(at, value, true);
      at += 8;
      return writer;
    },
    raw: (value) => {
      room(value.length);
      bytes.set(value, at);
      at += value.length;
      return writer;
    },
    text: (value) => {
      const encoded = new TextEncoder().encode(value);
      return writer.u32(encoded.length).raw(encoded);
    },
    finish: () => {
      view.setUint32(0, SCENE_HOST_MAGIC, true);
      view.setUint32(4, kind, true);
      view.setUint32(8, at - HEADER_BYTES, true);
      return bytes.slice(0, at);
    },
  };
  return writer;
};

export interface ISceneHostParam {
  id: string;
  value: number;
  min: number;
  max: number;
}

/** A scene as the host draws it: everything already resolved by main. */
export interface ISceneHostScene {
  guarded: boolean;
  response: {
    sensitivity: number;
    threshold: number;
    attack: number;
    release: number;
  };
  params: readonly ISceneHostParam[];
  vertexSource: string;
  fragmentSource: string;
  view: readonly [number, number, number, number];
  spectrumRect: readonly [number, number, number, number];
  /** The pack's WebP as it was signed, and the size its header says. */
  artwork?: { width: number; height: number; webp: Uint8Array };
}

export const encodeShow = (
  id: number,
  swatch: readonly (readonly [number, number, number])[],
  scene?: ISceneHostScene,
): Uint8Array => {
  const writer = messageWriter(SCENE_HOST_KIND.show).u32(id);
  writer.u32(swatch.length);
  swatch.forEach((colour) => writer.raw(Uint8Array.from(colour)));
  if (!scene) {
    return writer.u32(0).finish();
  }
  writer
    .u32(1)
    .u32(scene.guarded ? 1 : 0)
    .f64(scene.response.sensitivity)
    .f64(scene.response.threshold)
    .f64(scene.response.attack)
    .f64(scene.response.release)
    .u32(scene.params.length);
  scene.params.forEach((param) =>
    writer.text(param.id).f64(param.value).f64(param.min).f64(param.max),
  );
  writer.text(scene.vertexSource).text(scene.fragmentSource);
  scene.view.forEach((value) => writer.f64(value));
  scene.spectrumRect.forEach((value) => writer.f64(value));
  const { artwork } = scene;
  return writer
    .u32(artwork?.width ?? 0)
    .u32(artwork?.height ?? 0)
    .u32(artwork?.webp.length ?? 0)
    .raw(artwork?.webp ?? new Uint8Array(0))
    .finish();
};

export const encodeDaylight = (
  daylight: { clock: true } | { clock: false; value: number },
): Uint8Array =>
  messageWriter(SCENE_HOST_KIND.daylight)
    .u32(daylight.clock ? DAYLIGHT_MODE.clock : DAYLIGHT_MODE.fixed)
    .f64(daylight.clock ? 0 : daylight.value)
    .finish();

export const encodePause = (paused: boolean): Uint8Array =>
  messageWriter(SCENE_HOST_KIND.pause)
    .u32(paused ? 1 : 0)
    .finish();

export const encodeProfile = (hold: boolean, idleSpeed: number): Uint8Array =>
  messageWriter(SCENE_HOST_KIND.profile)
    .u32(hold ? 1 : 0)
    .f64(idleSpeed)
    .finish();

export const encodeAccent = (
  accent: readonly [number, number, number],
): Uint8Array =>
  messageWriter(SCENE_HOST_KIND.accent)
    .f64(accent[0])
    .f64(accent[1])
    .f64(accent[2])
    .finish();

export const encodePreview = (wanted: boolean): Uint8Array =>
  messageWriter(SCENE_HOST_KIND.preview)
    .u32(wanted ? 1 : 0)
    .finish();

export interface ISceneHostGrid {
  width: number;
  height: number;
  level: number;
  beat: number;
  bass: number;
  mid: number;
  treble: number;
  deltaMs: number;
  timeSeconds: number;
  activity: number;
  /** Drawn from the scene, rather than lit with its colours. */
  drawn: boolean;
  rgb: Uint8Array;
}

export interface ISceneHostHandlers {
  grid(grid: ISceneHostGrid): void;
  picture(width: number, height: number, rgb: Uint8Array): void;
  loaded(id: number): void;
  failed(id: number, reason: TSceneHostFailure, words: string): void;
  /** The stream stopped making sense; nothing more is read from it. */
  invalid(why: string): void;
}

/** The grid's and the picture's own bounds (`lamp_pacing.h`, `lamp_painter.cpp`). */
const GRID_WIDTH = 48;
const GRID_HEIGHT = 27;
const PICTURE_MAX_WIDTH = 192;
const PICTURE_MAX_HEIGHT = 108;

/** One message's payload read, false when it is not exactly that message. */
const readMessage = (
  kind: number,
  payload: Uint8Array,
  handlers: ISceneHostHandlers,
): boolean => {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const u32 = (at: number) => view.getUint32(at, true);
  const f64 = (at: number) => view.getFloat64(at, true);
  if (kind === SCENE_HOST_KIND.grid) {
    const fixed = 8 + 8 * 8 + 4;
    if (payload.length < fixed) {
      return false;
    }
    const width = u32(0);
    const height = u32(4);
    if (
      width !== GRID_WIDTH ||
      height !== GRID_HEIGHT ||
      payload.length !== fixed + width * height * 3
    ) {
      return false;
    }
    const drawn = u32(8 + 8 * 8);
    if (drawn > 1) {
      return false;
    }
    handlers.grid({
      width,
      height,
      level: f64(8),
      beat: f64(16),
      bass: f64(24),
      mid: f64(32),
      treble: f64(40),
      deltaMs: f64(48),
      timeSeconds: f64(56),
      activity: f64(64),
      drawn: drawn === 1,
      // Copied out: the stream's buffer is reused for what follows.
      rgb: payload.slice(fixed),
    });
    return true;
  }
  if (kind === SCENE_HOST_KIND.picture) {
    if (payload.length < 8) {
      return false;
    }
    const width = u32(0);
    const height = u32(4);
    if (
      width === 0 ||
      height === 0 ||
      width > PICTURE_MAX_WIDTH ||
      height > PICTURE_MAX_HEIGHT ||
      payload.length !== 8 + width * height * 3
    ) {
      return false;
    }
    handlers.picture(width, height, payload.slice(8));
    return true;
  }
  if (kind === SCENE_HOST_KIND.loaded) {
    if (payload.length !== 4) {
      return false;
    }
    handlers.loaded(u32(0));
    return true;
  }
  if (kind === SCENE_HOST_KIND.failed) {
    if (payload.length < 12 || payload.length !== 12 + u32(8)) {
      return false;
    }
    const reason = u32(4);
    handlers.failed(
      u32(0),
      SCENE_HOST_FAILURES[reason - 1] ?? 'unknown',
      new TextDecoder().decode(payload.subarray(12)),
    );
    return true;
  }
  return false;
};

/**
 * The host's stdout read chunk by chunk, each whole message handed to
 * `read` by its kind; a message `read` refuses, or a stream without the
 * header, is the stream broken, and nothing more is read from it.
 */
export const createSceneHostFrameReader = (
  read: (kind: number, payload: Uint8Array) => boolean,
  invalid: (why: string) => void,
): ((chunk: Uint8Array) => void) => {
  let pending = new Uint8Array(0);
  let broken = false;
  return (chunk) => {
    if (broken) {
      return;
    }
    const joined = new Uint8Array(pending.length + chunk.length);
    joined.set(pending);
    joined.set(chunk, pending.length);
    let at = 0;
    while (joined.length - at >= HEADER_BYTES) {
      const header = new DataView(joined.buffer, joined.byteOffset + at);
      const magic = header.getUint32(0, true);
      const kind = header.getUint32(4, true);
      const length = header.getUint32(8, true);
      if (magic !== SCENE_HOST_MAGIC || length > MAX_PAYLOAD_BYTES) {
        broken = true;
        invalid('a message without the scene host header');
        return;
      }
      if (joined.length - at < HEADER_BYTES + length) {
        break;
      }
      const payload = joined.subarray(
        at + HEADER_BYTES,
        at + HEADER_BYTES + length,
      );
      at += HEADER_BYTES + length;
      if (!read(kind, payload)) {
        broken = true;
        invalid(`a message of kind ${kind} that is not one`);
        return;
      }
    }
    pending = joined.slice(at);
  };
};

/** Reads the host's stdout chunk by chunk, handing on each whole message. */
export const createSceneHostReader = (
  handlers: ISceneHostHandlers,
): ((chunk: Uint8Array) => void) =>
  createSceneHostFrameReader(
    (kind, payload) => readMessage(kind, payload, handlers),
    handlers.invalid,
  );
