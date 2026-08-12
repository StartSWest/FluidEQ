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

import {
  KARAOKE_CANONICAL_CENTER_MIDI,
  providerPitchToCanonicalMidi,
  TKaraokeProviderPitchUnit,
  TKaraokePitchOctavePolicy,
} from './pitch';
import { IKaraokeToken } from './types';

export type TKaraokeProviderTimeUnit =
  'milliseconds' | 'seconds' | 'beats' | 'ticks';

export interface IKaraokeProviderClock {
  unit: TKaraokeProviderTimeUnit;
  /** Applied after converting the provider value to milliseconds. */
  offsetMs?: number;
  /** Required for beat/tick clocks. */
  bpm?: number;
  /** Required for tick clocks: provider ticks in one quarter-note beat. */
  ticksPerBeat?: number;
}

export interface IKaraokeProviderPitchMapping {
  unit: TKaraokeProviderPitchUnit;
  /** MIDI center used by providers whose note values are relative. */
  relativeCenterMidi?: number;
  octavePolicy: TKaraokePitchOctavePolicy;
}

export interface IKaraokeProviderToken {
  text: string;
  startsWord?: boolean;
  start?: number;
  end?: number;
  duration?: number;
  pitch?: number;
  kind?: IKaraokeToken['kind'];
}

/**
 * Convert a provider clock into FluidEQ's one timeline: song milliseconds.
 * Adapters can therefore use seconds, beats or arbitrary MIDI-style ticks
 * without leaking their coordinate system into playback or Canvas code.
 */
export const providerTimeToMilliseconds = (
  value: number,
  clock: IKaraokeProviderClock,
): number => {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }
  const offsetMs = Number.isFinite(clock.offsetMs) ? (clock.offsetMs ?? 0) : 0;
  if (clock.unit === 'milliseconds') {
    return offsetMs + value;
  }
  if (clock.unit === 'seconds') {
    return offsetMs + value * 1_000;
  }
  if (!Number.isFinite(clock.bpm) || (clock.bpm ?? 0) <= 0) {
    return Number.NaN;
  }
  const beatMs = 60_000 / (clock.bpm as number);
  if (clock.unit === 'beats') {
    return offsetMs + value * beatMs;
  }
  if (!Number.isFinite(clock.ticksPerBeat) || (clock.ticksPerBeat ?? 0) <= 0) {
    return Number.NaN;
  }
  return offsetMs + (value * beatMs) / (clock.ticksPerBeat as number);
};

/**
 * Normalize one token supplied by any karaoke adapter. The UI only consumes
 * this result and never needs to know the original provider, clock or pitch
 * scale. Invalid optional coordinates are omitted instead of poisoning a
 * complete song with NaN values.
 */
export const normalizeKaraokeProviderToken = (
  token: IKaraokeProviderToken,
  clock: IKaraokeProviderClock,
  pitchMapping?: IKaraokeProviderPitchMapping,
): IKaraokeToken => {
  const startMs =
    token.start === undefined
      ? undefined
      : providerTimeToMilliseconds(token.start, clock);
  const rawEnd =
    token.end ??
    (token.start !== undefined && token.duration !== undefined
      ? token.start + token.duration
      : undefined);
  const endMs =
    rawEnd === undefined
      ? undefined
      : providerTimeToMilliseconds(rawEnd, clock);
  const targetMidi =
    token.pitch === undefined || !pitchMapping
      ? undefined
      : providerPitchToCanonicalMidi(
          token.pitch,
          pitchMapping.unit,
          pitchMapping.relativeCenterMidi ?? KARAOKE_CANONICAL_CENTER_MIDI,
        );

  return {
    text: token.text,
    startsWord: token.startsWord,
    startMs: Number.isFinite(startMs) ? startMs : undefined,
    endMs: Number.isFinite(endMs) ? endMs : undefined,
    targetMidi: Number.isFinite(targetMidi) ? targetMidi : undefined,
    kind: token.kind,
  };
};

/** Friendly fallback for a provider that does not have localized app copy. */
export const karaokeProviderDisplayName = (providerId: string): string => {
  const words = providerId
    .trim()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!words) {
    return '';
  }
  return words
    .split(' ')
    .map((word) => {
      const normalized = word.toLowerCase();
      if (['cdg', 'lrc', 'midi', 'ttml', 'vtt', 'xml'].includes(normalized)) {
        return normalized.toUpperCase();
      }
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
};
