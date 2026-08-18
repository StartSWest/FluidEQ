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
  IKaraokeLine,
  IKaraokeParsedLyrics,
  IKaraokeToken,
  KaraokeParseError,
} from './types';
import { normalizeKaraokeProviderToken } from './provider';

const parseDecimal = (value: string): number =>
  Number(value.trim().replace(',', '.'));

/**
 * Parse the text UltraStar format used by UltraStar Deluxe/Performous.
 *
 * Timing positions are quarter-beats. In RELATIVE songs, the value on a line
 * break becomes the origin for the next line; in ordinary songs every value is
 * already absolute. Duet/player sections remain an explicitly unsupported
 * variant instead of silently merging two singers.
 */
// A named parser reads more clearly at each importer call site.
// eslint-disable-next-line import/prefer-default-export
export const parseUltraStar = (contents: string): IKaraokeParsedLyrics => {
  const rows = contents
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  if (!rows.some((row) => row.trim())) {
    throw new KaraokeParseError('empty', 'The UltraStar file is empty.');
  }

  const metadata = new Map<string, string>();
  rows.forEach((row) => {
    const match = row.match(/^#([^:]+):(.*)$/);
    if (match) {
      metadata.set(match[1].trim().toUpperCase(), match[2].trim());
    }
  });
  if (
    metadata.has('DUETSINGERP1') ||
    metadata.has('DUETSINGERP2') ||
    rows.some((row) => /^P[12]\s*$/i.test(row.trim()))
  ) {
    throw new KaraokeParseError(
      'unsupported-variant',
      'UltraStar duet files are not supported yet.',
    );
  }

  const bpmValue = metadata.get('BPM');
  if (!bpmValue) {
    throw new KaraokeParseError(
      'missing-bpm',
      'The UltraStar file does not declare BPM.',
    );
  }
  const bpm = parseDecimal(bpmValue);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new KaraokeParseError(
      'invalid-bpm',
      'The UltraStar BPM value is invalid.',
    );
  }

  const gapCandidate = parseDecimal(metadata.get('GAP') ?? '0');
  const gapMs = Number.isFinite(gapCandidate) ? gapCandidate : 0;
  const language = metadata.get('LANGUAGE')?.trim() || undefined;
  // The stage media, named by the song rather than guessed from the folder.
  // A trimmed empty tag is treated as absent: `#COVER:` with nothing after it
  // appears in real files and must not become a lookup for the empty name.
  const coverFileName = metadata.get('COVER')?.trim() || undefined;
  const backgroundFileName = metadata.get('BACKGROUND')?.trim() || undefined;
  const videoFileName = metadata.get('VIDEO')?.trim() || undefined;
  // Seconds in the file, milliseconds everywhere in this codebase. Decimal
  // because `#VIDEOGAP:4.5` is legal, and the same comma-or-point tolerance
  // the other numbers here get — these files come from every locale in Europe.
  const videoGapCandidate = parseDecimal(metadata.get('VIDEOGAP') ?? '');
  const videoGapMs = Number.isFinite(videoGapCandidate)
    ? videoGapCandidate * 1000
    : undefined;
  const relative = /^(yes|true|1)$/i.test(metadata.get('RELATIVE') ?? '');
  const providerClock = {
    unit: 'ticks' as const,
    bpm,
    ticksPerBeat: 4,
    offsetMs: gapMs,
  };
  const providerPitch = {
    unit: 'relative-semitones' as const,
    octavePolicy: 'nearest-target' as const,
  };
  const lines: IKaraokeLine[] = [];
  let pendingTokens: IKaraokeToken[] = [];
  let lineOriginBeat = 0;

  const flushLine = () => {
    if (!pendingTokens.length) {
      return;
    }
    const [firstToken] = pendingTokens;
    const { startMs } = firstToken;
    const endMs = pendingTokens.reduce(
      (latest, token) => Math.max(latest, token.endMs ?? latest),
      startMs ?? 0,
    );
    lines.push({
      id: `ultrastar-${lines.length}-${Math.round(startMs ?? 0)}`,
      startMs,
      endMs,
      tokens: pendingTokens,
    });
    pendingTokens = [];
  };

  rows.forEach((rawRow, rowIndex) => {
    const row = rawRow.trimEnd();
    if (!row || row.startsWith('#')) {
      return;
    }
    if (/^E\s*$/i.test(row)) {
      flushLine();
      return;
    }
    if (row.startsWith('-')) {
      flushLine();
      if (relative) {
        const [, originField] = row.trim().split(/\s+/);
        const nextOrigin = Number(originField);
        if (Number.isFinite(nextOrigin)) {
          lineOriginBeat = nextOrigin;
        }
      }
      return;
    }
    if (/^P[12]\s*$/i.test(row.trim())) {
      throw new KaraokeParseError(
        'unsupported-variant',
        'UltraStar duet files are not supported yet.',
        rowIndex + 1,
      );
    }

    const note = row.match(/^([:*F])\s+(-?\d+)\s+(\d+)\s+(-?\d+)(?:\s(.*))?$/i);
    if (!note) {
      throw new KaraokeParseError(
        'malformed-note',
        `Invalid UltraStar note on line ${rowIndex + 1}.`,
        rowIndex + 1,
      );
    }
    const startBeat = Number(note[2]) + (relative ? lineOriginBeat : 0);
    const durationBeats = Number(note[3]);
    const pitch = Number(note[4]);
    const marker = note[1].toUpperCase();
    let kind: IKaraokeToken['kind'] = 'normal';
    if (marker === '*') {
      kind = 'golden';
    } else if (marker === 'F') {
      kind = 'free';
    }
    const rawText = note[5] ?? '';
    pendingTokens.push(
      normalizeKaraokeProviderToken(
        {
          // UltraStar uses a leading space for a new word and `~` as a
          // syllable/melisma join marker. The first token after a line break
          // is also necessarily a new word without a leading space.
          text: rawText.replace(/~/g, ''),
          startsWord: pendingTokens.length === 0 || /^\s/.test(rawText),
          start: startBeat,
          duration: durationBeats,
          pitch,
          kind,
        },
        providerClock,
        providerPitch,
      ),
    );
  });
  flushLine();

  if (!lines.length) {
    throw new KaraokeParseError(
      'missing-timing',
      'No UltraStar notes were found.',
    );
  }
  const notes = lines.flatMap((line) => line.tokens);
  return {
    title: metadata.get('TITLE'),
    artist: metadata.get('ARTIST'),
    audioFileName:
      metadata.get('MP3') ?? metadata.get('AUDIO') ?? metadata.get('VIDEO'),
    timingPrecision: 'syllable',
    lines,
    pitch: {
      kind: 'notes',
      source: 'ultrastar',
      coordinateSystem: 'midi-semitones',
      octavePolicy: 'nearest-target',
      notes,
    },
    gapMs,
    bpm,
    language,
    coverFileName,
    backgroundFileName,
    videoFileName,
    videoGapMs,
    sourceFormat: 'ultrastar',
  };
};
