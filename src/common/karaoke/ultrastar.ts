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
 * The player row, in every spelling and for every voice.
 *
 * USDX reads the digit from position 2 or 3 depending on whether a space
 * follows the `P`, so `P1` and `P 1` are the same row, and the format defines
 * `#P1` through `#P9`. Matching only `P1`/`P2` meant a modern duet fell
 * through to the note regex and was reported as a malformed file, and a
 * three-voice song merged all three singers into one track in silence.
 */
const DUET_PLAYER_ROW = /^P\s*[1-9]\s*$/i;
const DUET_SINGER_HEADER = /^P[1-9]$/;

/**
 * `note-type = %x21-22 / %x24-7E` — any visible ASCII but space and `#`.
 *
 * Deliberately the whole class rather than the five types this app models.
 * The format says an implementation MAY substitute freestyle for a type it
 * does not know and MUST NOT invent semantics for one; it does not permit
 * dropping the syllable, which is what a narrower class here did — a note
 * marked with an unmodelled type vanished, lyric and all, with no error.
 */
const NOTE_ROW = /^([!-"$-~])\s+(-?\d+)\s+(\d+)\s+(-?\d+)(?:\s(.*))?$/;

/** The two types this app scores against a pitch; everything else sings free. */
const PITCHED_NOTE_TYPES = new Set([':', '*']);

/**
 * A row that opens like a note and then is not one.
 *
 * The distinction decides whether a file is rejected or a line is skipped:
 * prose and ripper credits are ignored the way UltraStar Deluxe ignores them,
 * but a marker followed by numbers that do not parse is a genuine defect
 * worth naming with its line number.
 */
const NOTE_SHAPED_ROW = /^[!-"$-~]\s+-?\d/;

/** `B <beat> <bpm>`, the variable-tempo row USDX warns about and ignores. */
const VARIABLE_BPM_ROW = /^B\s+-?[\d.,]+\s+[\d.,]+\s*$/i;

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
    // `#DUETSINGERP1` is the deprecated spelling; `#P1`/`#P2` is what current
    // files carry. Reading only the old pair meant a modern duet reached the
    // note loop and died as `malformed-note`, which blames the file for
    // something the parser simply had not been taught to recognise.
    metadata.has('DUETSINGERP1') ||
    metadata.has('DUETSINGERP2') ||
    Array.from(metadata.keys()).filter((key) => DUET_SINGER_HEADER.test(key))
      .length >= 2 ||
    rows.some((row) => DUET_PLAYER_ROW.test(row.trim()))
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
  // Tested before parsing rather than after: `Number('')` is 0, not NaN, so
  // asking `Number.isFinite` about an absent tag answered yes and every song
  // reported a declared video gap of zero.
  const videoGapField = metadata.get('VIDEOGAP')?.trim();
  const videoGapCandidate = videoGapField
    ? parseDecimal(videoGapField)
    : Number.NaN;
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

  // A plain loop rather than `forEach`, because `E` has to stop the parse and
  // not merely skip its own row: the format says everything after a trailing
  // `E` MUST be ignored, and real packs put ripper credits down there.
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex].trimEnd();
    if (/^E\s*$/i.test(row)) {
      break;
    }
    // Skipped rather than fatal: a blank line, a header, and — the reason this
    // is not an error — the prose and ripper credits twenty-year-old packs
    // carry between their notes, which UltraStar Deluxe also walks past.
    if (row && !row.startsWith('#')) {
      if (row.startsWith('-')) {
        flushLine();
        if (relative) {
          const [, endField, nextStartField] = row.trim().split(/\s+/);
          // UltraStar Deluxe ADDS the second number to a running origin
          // (`Rel := Rel + Param2`); it does not assign it. Assigning meant
          // the origin never advanced, so from the second line break onward
          // every line landed on top of the one before it — at 120 BPM with
          // 20-beat breaks the tenth line was twenty seconds early. Files
          // carrying only one number end and restart on the same beat.
          const advance = Number(nextStartField ?? endField);
          if (Number.isFinite(advance)) {
            lineOriginBeat += advance;
          }
        }
      } else {
        const note = row.match(NOTE_ROW);
        // Only a row that announces itself as a note and then fails to parse
        // is worth naming; `B <beat> <bpm>` is a tempo row USDX warns about
        // and ignores, and anything else was never claiming to be a note.
        if (!note) {
          if (!VARIABLE_BPM_ROW.test(row) && NOTE_SHAPED_ROW.test(row)) {
            throw new KaraokeParseError(
              'malformed-note',
              `Invalid UltraStar note on line ${rowIndex + 1}.`,
              rowIndex + 1,
            );
          }
        } else {
          const startBeat = Number(note[2]) + (relative ? lineOriginBeat : 0);
          const durationBeats = Number(note[3]);
          const pitch = Number(note[4]);
          const marker = note[1].toUpperCase();
          let kind: IKaraokeToken['kind'] = 'normal';
          if (marker === '*') {
            kind = 'golden';
          } else if (!PITCHED_NOTE_TYPES.has(marker)) {
            // Rap notes have no pitch to hit — UltraStar scores them on noise,
            // not tone — and a type this app has never heard of has no meaning
            // it is allowed to invent. Both become freestyle, the substitution
            // the format sanctions. Before this, one rap syllable made a
            // three-hundred-note song fail to open at all.
            kind = 'free';
          }
          if (durationBeats === 0) {
            // A zero-length note cannot be sung, let alone hit. UltraStar
            // Deluxe rewrites it as freestyle rather than leaving an
            // unreachable target dragging a score down.
            kind = 'free';
          }
          const rawText = note[5] ?? '';
          pendingTokens.push(
            normalizeKaraokeProviderToken(
              {
                // UltraStar uses a leading space for a new word and `~` as a
                // syllable/melisma join marker. The first token after a line
                // break is also necessarily a new word without a leading space.
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
        }
      }
    }
  }
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
    // `#AUDIO` supersedes `#MP3`: the format says an implementation SHOULD
    // disregard `#MP3` when `#AUDIO` is present, even when the named file is
    // missing, because `#MP3` is the deprecated tag kept for old players and
    // is where a stale filename survives. `#VIDEO` was a fallback here and is
    // not one — pointing the audio element at an AVI names a file this build
    // cannot decode.
    audioFileName: metadata.get('AUDIO') ?? metadata.get('MP3'),
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
