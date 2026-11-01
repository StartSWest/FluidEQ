/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What crosses between Electron's main and the core's own process
 * (`coreProcess.ts`, `main/coreProcess/coreClient.ts`): never a block of
 * sound, only what is made of it — a clock's step, a desktop frame asked
 * for, a trim to write. The window's sound port is handed across whole and
 * the blocks go down it from the core straight to the window.
 *
 * Each side reads the other's messages through the parser here, so a message
 * of the wrong shape is dropped where it arrives instead of half-read.
 */
import type { IApoHeadroomState } from '../headroom/apoHeadroom';
import type { IDesktopFrame } from '../liveFrames/desktopFrames';

/** Main to the core. A `port` message carries the window's port with it. */
export type TToCore =
  | { kind: 'port'; id: number }
  | { kind: 'desktop-want'; wanted: boolean }
  | { kind: 'desktop-read'; id: number }
  | { kind: 'desktop-output-changed' }
  | {
      kind: 'clock-follow';
      id: number;
      secondsPerStep: number;
      wanted: boolean;
    }
  | { kind: 'clock-reset'; id: number }
  | { kind: 'headroom-follow'; state: IApoHeadroomState }
  | { kind: 'headroom-edited' }
  | { kind: 'headroom-output-changed' }
  | { kind: 'trim-result'; id: number; applied: boolean };

/** The core to main. */
export type TFromCore =
  | { kind: 'ready' }
  | { kind: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { kind: 'port-gone'; id: number }
  | { kind: 'desktop-frame'; id: number; frame: IDesktopFrame }
  | { kind: 'desktop-serves'; serves: boolean }
  | { kind: 'clock-step'; id: number }
  | { kind: 'clock-lost'; id: number }
  | { kind: 'trim'; id: number; trimDb: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isHeadroomState = (value: unknown): value is IApoHeadroomState =>
  isRecord(value) &&
  typeof value.enabled === 'boolean' &&
  isFiniteNumber(value.trimDb) &&
  typeof value.hasLegacyProgramme === 'boolean';

const isFrame = (value: unknown): value is IDesktopFrame =>
  isRecord(value) &&
  Array.isArray(value.points) &&
  Array.isArray(value.waveform) &&
  (value.stereo === undefined ||
    (Array.isArray(value.stereo) &&
      value.stereo.length === 2 &&
      value.stereo.every(isFiniteNumber)));

export const parseToCore = (raw: unknown): TToCore | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  switch (raw.kind) {
    case 'port':
    case 'desktop-read':
    case 'clock-reset':
      return isId(raw.id) ? { kind: raw.kind, id: raw.id } : undefined;
    case 'desktop-want':
      return typeof raw.wanted === 'boolean'
        ? { kind: 'desktop-want', wanted: raw.wanted }
        : undefined;
    case 'desktop-output-changed':
    case 'headroom-edited':
    case 'headroom-output-changed':
      return { kind: raw.kind };
    case 'clock-follow':
      return isId(raw.id) &&
        isFiniteNumber(raw.secondsPerStep) &&
        raw.secondsPerStep > 0 &&
        typeof raw.wanted === 'boolean'
        ? {
            kind: 'clock-follow',
            id: raw.id,
            secondsPerStep: raw.secondsPerStep,
            wanted: raw.wanted,
          }
        : undefined;
    case 'headroom-follow':
      return isHeadroomState(raw.state)
        ? {
            kind: 'headroom-follow',
            state: {
              enabled: raw.state.enabled,
              trimDb: raw.state.trimDb,
              hasLegacyProgramme: raw.state.hasLegacyProgramme,
            },
          }
        : undefined;
    case 'trim-result':
      return isId(raw.id) && typeof raw.applied === 'boolean'
        ? { kind: 'trim-result', id: raw.id, applied: raw.applied }
        : undefined;
    default:
      return undefined;
  }
};

export const parseFromCore = (raw: unknown): TFromCore | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  switch (raw.kind) {
    case 'ready':
      return { kind: 'ready' };
    case 'log':
      return (raw.level === 'info' ||
        raw.level === 'warn' ||
        raw.level === 'error') &&
        typeof raw.message === 'string'
        ? { kind: 'log', level: raw.level, message: raw.message }
        : undefined;
    case 'port-gone':
    case 'clock-step':
    case 'clock-lost':
      return isId(raw.id) ? { kind: raw.kind, id: raw.id } : undefined;
    case 'desktop-frame':
      return isId(raw.id) && isFrame(raw.frame)
        ? { kind: 'desktop-frame', id: raw.id, frame: raw.frame }
        : undefined;
    case 'desktop-serves':
      return typeof raw.serves === 'boolean'
        ? { kind: 'desktop-serves', serves: raw.serves }
        : undefined;
    case 'trim':
      return isId(raw.id) && isFiniteNumber(raw.trimDb)
        ? { kind: 'trim', id: raw.id, trimDb: raw.trimDb }
        : undefined;
    default:
      return undefined;
  }
};
