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

import { IKaraokeLine } from './types';

export interface IKaraokeClockSnapshot {
  nowMs: number;
  durationMs: number;
  state: 'empty' | 'loading' | 'paused' | 'playing' | 'ended' | 'error';
}

export interface IKaraokeMediaClockSource {
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  error?: unknown;
  play(): Promise<void>;
  pause(): void;
}

export const clampKaraokeTime = (timeMs: number, durationMs: number): number =>
  Math.min(
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : Infinity,
    Math.max(0, Number.isFinite(timeMs) ? timeMs : 0),
  );

const clockStateForSource = (
  source: IKaraokeMediaClockSource,
): IKaraokeClockSnapshot['state'] => {
  if (source.error) {
    return 'error';
  }
  if (source.ended) {
    return 'ended';
  }
  return source.paused ? 'paused' : 'playing';
};

export class TrackClock {
  source: IKaraokeMediaClockSource;

  constructor(source: IKaraokeMediaClockSource) {
    this.source = source;
  }

  read(): IKaraokeClockSnapshot {
    const durationMs = Number.isFinite(this.source.duration)
      ? Math.max(0, this.source.duration * 1_000)
      : 0;
    const nowMs = clampKaraokeTime(this.source.currentTime * 1_000, durationMs);
    return {
      nowMs,
      durationMs,
      state: clockStateForSource(this.source),
    };
  }

  play(): Promise<void> {
    return this.source.play();
  }

  pause(): void {
    this.source.pause();
  }

  seek(nextMs: number): void {
    const durationMs = Number.isFinite(this.source.duration)
      ? this.source.duration * 1_000
      : 0;
    this.source.currentTime = clampKaraokeTime(nextMs, durationMs) / 1_000;
  }
}

export const findActiveKaraokeLine = (
  lines: readonly IKaraokeLine[],
  nowMs: number,
): number => {
  let active = -1;
  let latestStartMs = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < lines.length; index += 1) {
    const { startMs } = lines[index];
    // Maker projects deliberately retain unmatched reference lines without
    // inventing timestamps. Skip those holes so one missing Whisper sentence
    // cannot prevent every later, correctly detected line from reaching the
    // live preview.
    if (startMs !== undefined && startMs <= nowMs && startMs >= latestStartMs) {
      latestStartMs = startMs;
      active = index;
    }
  }
  return active;
};

export const formatKaraokeTime = (timeMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
