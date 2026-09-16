/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room's head file, read on the app's side.
 *
 * The same text the engine reads (`native/system-apo/src/room_head.h`): a
 * name line, then per rate a `rate R directions D taps T` line and D lines
 * of 2·T numbers, the left ear's response then the right's, for the
 * direction D·15° clockwise from straight ahead. The Fit dialog renders its
 * listening pairs through these in the window, so it needs the numbers and
 * not the file.
 */

export interface IRoomHeadBlock {
  sampleRate: number;
  directions: number;
  taps: number;
  /** `directions` arrays of `taps` samples each. */
  left: Float32Array<ArrayBuffer>[];
  right: Float32Array<ArrayBuffer>[];
}

const RATES = [44100, 48000, 96000];
const HEADER = /^rate (\d+) directions (\d+) taps (\d+)$/;

interface IHeader {
  at: number;
  directions: number;
  taps: number;
}

/** The line that opens the block at `sampleRate`, and what it declares. */
const headerAt = (lines: string[], sampleRate: number): IHeader | undefined =>
  lines.reduce<IHeader | undefined>((found, line, at) => {
    const header = found ? null : HEADER.exec(line);
    if (!header || Number(header[1]) !== sampleRate) {
      return found;
    }
    return { at, directions: Number(header[2]), taps: Number(header[3]) };
  }, undefined);

/**
 * The block at `sampleRate` (one of 44.1, 48, 96 kHz), or undefined for a
 * rate the file does not carry or a block short of its numbers — a head of
 * zeros would render silence and be believed.
 */
export const parseRoomHeadBlock = (
  text: string,
  sampleRate: number,
): IRoomHeadBlock | undefined => {
  if (!RATES.includes(sampleRate)) {
    return undefined;
  }
  const lines = text.split(/\r?\n/);
  const header = headerAt(lines, sampleRate);
  if (!header) {
    return undefined;
  }
  const { at, directions, taps } = header;
  if (directions <= 0 || taps <= 0 || directions > 72 || taps > 4096) {
    return undefined;
  }
  const left: Float32Array<ArrayBuffer>[] = [];
  const right: Float32Array<ArrayBuffer>[] = [];
  for (let direction = 0; direction < directions; direction += 1) {
    const row = lines[at + 1 + direction];
    if (row === undefined) {
      return undefined;
    }
    const numbers = row.trim().split(/\s+/).map(Number);
    if (numbers.length !== taps * 2 || numbers.some(Number.isNaN)) {
      return undefined;
    }
    left.push(Float32Array.from(numbers.slice(0, taps)));
    right.push(Float32Array.from(numbers.slice(taps)));
  }
  return { sampleRate, directions, taps, left, right };
};

/** The ring index nearest an azimuth, degrees clockwise from ahead. */
export const nearestDirection = (
  block: Pick<IRoomHeadBlock, 'directions'>,
  angleDeg: number,
): number => {
  const step = 360 / block.directions;
  const wrapped = ((angleDeg % 360) + 360) % 360;
  return Math.round(wrapped / step) % block.directions;
};
