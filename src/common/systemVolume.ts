/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The system volume — the level and mute of the default playback output
 * — as the window and main pass it between them.
 *
 * The window asks on `SYSTEM_VOLUME_CHANNEL`: `['watch', true | false]`
 * while something shows it, `['set', level]`, `['mute', true | false]`.
 * Main answers on `SYSTEM_VOLUME_CHANGED` with the level and mute, or `null`
 * when there is no output to control, first when watching starts and then
 * after every change made anywhere.
 */
export const SYSTEM_VOLUME_CHANNEL = 'system-volume';
export const SYSTEM_VOLUME_CHANGED = 'system-volume-changed';

export interface ISystemVolume {
  /** Actual output scalar, 0 to 1; absent when the device cannot report it. */
  level?: number;
  isMuted?: boolean;
  /** Absent on legacy helpers; false means this output cannot set it. */
  canSetLevel?: boolean;
  canMute?: boolean;
  /** Native output identity, so pending writes cannot cross an output switch. */
  deviceId?: string;
  /** Native v2 acknowledges commands after querying the real output. */
  canAcknowledge?: boolean;
  sessionId?: string;
  appliedRequestId?: string;
}

/**
 * One line from the helper (`native/volume-watch/src/main.cpp`): a volume,
 * `null` for no output, or `undefined` for a line that is neither — which
 * is ignored rather than drawn.
 */
export const parseSystemVolumeLine = (
  line: string,
): ISystemVolume | null | undefined => {
  const record = line.replace(/\r$/, '');
  if (record === 'none') {
    return null;
  }
  const match =
    /^volume\t(-|\d+(?:\.\d+)?)\t(-|[01])(?:\t([01])\t([01])\t([1-9]\d{0,9}))?$/.exec(
      record,
    );
  if (!match) {
    return undefined;
  }
  const level = match[1] === '-' ? undefined : Number(match[1]);
  const isMuted = match[2] === '-' ? undefined : match[2] === '1';
  if (level !== undefined && !(level >= 0 && level <= 1)) {
    return undefined;
  }
  if (match[5] === undefined) {
    return level === undefined || isMuted === undefined
      ? undefined
      : { level, isMuted };
  }
  if (
    Number(match[5]) > 0xffff_ffff ||
    (match[3] === '1' && level === undefined) ||
    (match[4] === '1' && isMuted === undefined)
  ) {
    return undefined;
  }
  return {
    ...(level !== undefined ? { level } : {}),
    ...(isMuted !== undefined ? { isMuted } : {}),
    canSetLevel: match[3] === '1',
    canMute: match[4] === '1',
    deviceId: match[5],
  };
};

/** A level the helper accepts: a number from 0 to 1, as it writes one. */
export const systemVolumeCommand = (level: number): string | undefined =>
  Number.isFinite(level) && level >= 0 && level <= 1
    ? `set ${level.toFixed(4)}`
    : undefined;
