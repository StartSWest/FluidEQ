/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The system volume — the level and mute of the output Windows plays through
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
  /** 0 to 1, as the taskbar's volume slider reads it. */
  level: number;
  isMuted: boolean;
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
  const match = /^volume\t(\d+(?:\.\d+)?)\t([01])$/.exec(record);
  if (!match) {
    return undefined;
  }
  const level = Number(match[1]);
  if (!(level >= 0 && level <= 1)) {
    return undefined;
  }
  return { level, isMuted: match[2] === '1' };
};

/** A level the helper accepts: a number from 0 to 1, as it writes one. */
export const systemVolumeCommand = (level: number): string | undefined =>
  Number.isFinite(level) && level >= 0 && level <= 1
    ? `set ${level.toFixed(4)}`
    : undefined;
