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
   * `vocals` and `instrumental` are the two halves a separation produces, and
   * they are companions to `audio` rather than replacements — `audio` keeps
   * its identity as the file the user imported, which matters because the
   * Maker is keyed on it and a swapped audio asset silently remounted the
   * editor mid-session. When an instrumental is present the player's element
   * plays it instead of the mix, and the voice is blended back in at whatever
   * level the singer asks for. A song has both stems or neither.
   */
  role:
    | 'audio'
    | 'vocals'
    | 'instrumental'
    | 'video'
    /**
     * The two pictures a song folder carries, and they are not interchangeable.
     * A cover is artwork meant to be looked at whole — square, centred, the
     * thing a library grid shows. A background is scenery meant to sit behind
     * the words at whatever size the stage happens to be, so it is cropped
     * without apology. UltraStar names them separately for that reason and so
     * does this; showing a cover stretched across a widescreen stage is how
     * the distinction gets lost.
     */
    | 'cover'
    | 'background'
    | 'lyrics'
    | 'cdg'
    | 'midi'
    | 'soundfont';
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
    /**
     * How far the stage video runs ahead of or behind the audio, in ms.
     *
     * Separate from `gapMs`, which is when the singing starts. This one is a
     * property of the picture alone — a clip that opens with four seconds of
     * label before the song does.
     */
    videoGapMs?: number;
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
  /**
   * The stage media a format can name for itself, by file name only.
   *
   * Names rather than files, because parsing happens on text and knows
   * nothing about what else was imported alongside it. The session resolves
   * each name against the song's own directory, and falls back to matching by
   * base name for the formats that cannot say — LRC has no header for any of
   * this, so a picture sitting next to the audio is the only signal there is.
   */
  coverFileName?: string;
  backgroundFileName?: string;
  videoFileName?: string;
  /**
   * How far the video is offset from the audio, in milliseconds.
   *
   * UltraStar writes `#VIDEOGAP` in seconds and positive means the video
   * starts that much later than the song. Kept in milliseconds here like
   * every other time in this file, so nothing downstream has to remember
   * which unit this one arrived in.
   */
  videoGapMs?: number;
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
