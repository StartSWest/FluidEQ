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

import type { TKaraokePitchOctavePolicy } from './pitch';

export type TKaraokeTimingPrecision = 'none' | 'line' | 'word' | 'syllable';

export interface IKaraokeToken {
  text: string;
  /** True when this provider token begins a new displayed word. */
  startsWord?: boolean;
  startMs?: number;
  endMs?: number;
  targetMidi?: number;
  kind?: 'normal' | 'golden' | 'free';
}

export interface IKaraokeLine {
  id: string;
  /** Structural lyric metadata such as [Verse] or [Chorus], never a sung word. */
  kind?: 'lyrics' | 'section';
  startMs?: number;
  endMs?: number;
  tokens: IKaraokeToken[];
}

export type TKaraokePitchTarget =
  | {
      kind: 'notes';
      /** Stable provider identifier. The pitch lane must not branch on it. */
      source: string;
      /** All importers normalize their native values to this coordinate. */
      coordinateSystem: 'midi-semitones';
      /** Whether the provider encodes an absolute octave or only pitch class. */
      octavePolicy: TKaraokePitchOctavePolicy;
      notes: IKaraokeToken[];
    }
  | { kind: 'none'; reason: 'missing' | 'unsupported' | 'invalid' };

export interface IKaraokeAsset {
  id: string;
  /**
   * `vocals` is the isolated voice produced by separating the song, and it is
   * a companion to `audio` rather than a replacement: the player keeps playing
   * the backing track and blends this back in at whatever level the singer
   * asks for. A song either has both or neither.
   */
  role: 'audio' | 'vocals' | 'video' | 'lyrics' | 'cdg' | 'midi' | 'soundfont';
  file: File;
  extension: string;
}

export interface IKaraokeSong {
  id: string;
  title: string;
  artist?: string;
  durationMs?: number;
  assets: IKaraokeAsset[];
  timingPrecision: TKaraokeTimingPrecision;
  lines: IKaraokeLine[];
  pitch: TKaraokePitchTarget;
  meta: {
    /** Open provider id. Import adapters must not require a renderer change. */
    sourceFormat: string;
    gapMs: number;
    bpm?: number;
    language?: string;
  };
}

export interface IKaraokeParsedLyrics {
  title?: string;
  artist?: string;
  audioFileName?: string;
  timingPrecision: Exclude<TKaraokeTimingPrecision, 'none'>;
  lines: IKaraokeLine[];
  pitch: TKaraokePitchTarget;
  gapMs: number;
  bpm?: number;
  language?: string;
  /** Open provider id produced by the import adapter. */
  sourceFormat: string;
}

export type TKaraokeParseErrorCode =
  | 'empty'
  | 'missing-timing'
  | 'missing-bpm'
  | 'invalid-bpm'
  | 'malformed-note'
  | 'unsupported-variant';

export class KaraokeParseError extends Error {
  code: TKaraokeParseErrorCode;

  line?: number;

  constructor(code: TKaraokeParseErrorCode, message: string, line?: number) {
    super(message);
    this.name = 'KaraokeParseError';
    this.code = code;
    this.line = line;
  }
}
