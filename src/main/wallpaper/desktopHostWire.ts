/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createSceneHostFrameReader,
  encodeDaylight,
  encodeShow,
  messageWriter,
  SCENE_HOST_FAILURES,
  type ISceneHostScene,
  type TSceneHostFailure,
} from '../lighting/sceneHostWire';

/**
 * What main and `FluidEQ-Scenes --mode desktop` say to each other about the
 * desktop backgrounds (`native/scene-host/src/scene_wire.h` lists them,
 * `desktop_messages.cpp` is the other end): the lamps' framing, each message
 * naming its monitor first. A scene goes as the lamps' `show` does, with no
 * swatch: a monitor never falls back to colours.
 */

export const DESKTOP_HOST_KIND = {
  open: 20,
  show: 21,
  daylight: 22,
  scale: 23,
  pause: 24,
  close: 25,
  window: 120,
  loaded: 121,
  drawn: 122,
  failed: 123,
} as const;

/** The header every message starts with (`kHeaderBytes`). */
const HEADER_BYTES = 12;

/** `message`'s payload, after its monitor. */
const forMonitor = (kind: number, monitor: number, message: Uint8Array) =>
  messageWriter(kind).u32(monitor).raw(message.subarray(HEADER_BYTES)).finish();

export interface IMonitorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A corner as the other end reads it, signed: a monitor left of or above the
 * main one stands at negative pixels.
 */
const asSigned32 = (value: number): number =>
  value < 0 ? value + 2 ** 32 : value;

/** A window over `rect`, in physical pixels, drawn at `scale` of them. */
export const encodeMonitorOpen = (
  monitor: number,
  rect: IMonitorRect,
  scale: number,
): Uint8Array =>
  messageWriter(DESKTOP_HOST_KIND.open)
    .u32(monitor)
    .u32(asSigned32(rect.x))
    .u32(asSigned32(rect.y))
    .u32(rect.width)
    .u32(rect.height)
    .f64(scale)
    .finish();

export const encodeMonitorShow = (
  monitor: number,
  id: number,
  scene: ISceneHostScene,
): Uint8Array =>
  forMonitor(DESKTOP_HOST_KIND.show, monitor, encodeShow(id, [], scene));

export const encodeMonitorDaylight = (
  monitor: number,
  daylight: Parameters<typeof encodeDaylight>[0],
): Uint8Array =>
  forMonitor(DESKTOP_HOST_KIND.daylight, monitor, encodeDaylight(daylight));

export const encodeMonitorScale = (
  monitor: number,
  scale: number,
): Uint8Array =>
  messageWriter(DESKTOP_HOST_KIND.scale).u32(monitor).f64(scale).finish();

export const encodeMonitorPause = (
  monitor: number,
  paused: boolean,
): Uint8Array =>
  messageWriter(DESKTOP_HOST_KIND.pause)
    .u32(monitor)
    .u32(paused ? 1 : 0)
    .finish();

export const encodeMonitorClose = (monitor: number): Uint8Array =>
  messageWriter(DESKTOP_HOST_KIND.close).u32(monitor).finish();

export interface IDesktopHostHandlers {
  /** A monitor's window, for the desktop helper to place: its HWND. */
  window(monitor: number, hwnd: bigint): void;
  loaded(monitor: number, id: number): void;
  /** That scene's first frame is on the monitor. */
  drawn(monitor: number, id: number): void;
  failed(
    monitor: number,
    id: number,
    reason: TSceneHostFailure,
    words: string,
  ): void;
  /** The stream stopped making sense; nothing more is read from it. */
  invalid(why: string): void;
}

const readMessage = (
  kind: number,
  payload: Uint8Array,
  handlers: IDesktopHostHandlers,
): boolean => {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const u32 = (at: number) => view.getUint32(at, true);
  if (kind === DESKTOP_HOST_KIND.window) {
    if (payload.length !== 12) {
      return false;
    }
    handlers.window(u32(0), view.getBigUint64(4, true));
    return true;
  }
  if (kind === DESKTOP_HOST_KIND.loaded || kind === DESKTOP_HOST_KIND.drawn) {
    if (payload.length !== 8) {
      return false;
    }
    const told =
      kind === DESKTOP_HOST_KIND.loaded ? handlers.loaded : handlers.drawn;
    told(u32(0), u32(4));
    return true;
  }
  if (kind === DESKTOP_HOST_KIND.failed) {
    if (payload.length < 16 || payload.length !== 16 + u32(12)) {
      return false;
    }
    handlers.failed(
      u32(0),
      u32(4),
      SCENE_HOST_FAILURES[u32(8) - 1] ?? 'unknown',
      new TextDecoder().decode(payload.subarray(16)),
    );
    return true;
  }
  return false;
};

/** Reads the desktop host's stdout chunk by chunk. */
export const createDesktopHostReader = (
  handlers: IDesktopHostHandlers,
): ((chunk: Uint8Array) => void) =>
  createSceneHostFrameReader(
    (kind, payload) => readMessage(kind, payload, handlers),
    handlers.invalid,
  );
