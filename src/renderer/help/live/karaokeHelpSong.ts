/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IKaraokeChordSegment } from 'common/karaoke/chords';
import {
  createKaraokeMakerProject,
  type IKaraokeMakerProject,
} from 'common/karaoke/makerProject';
import {
  buildKaraokeScoreSheet,
  type IKaraokeNoteResult,
  type IKaraokeScoreSheet,
  KARAOKE_SCORE_MAX,
  type TKaraokeVerdict,
} from 'common/karaoke/scoring';
import type { IKaraokeLine, IKaraokeSong } from 'common/karaoke/types';
import type { IKaraokePitchPoint } from '../../karaoke/karaokePitchGeometry';

/**
 * The made-up song every Karaoke and Maker figure sings
 * (`karaokeFigures.tsx`, `makerFigures.tsx`): an invented title, artist,
 * words, melody and chords, so no figure ever shows somebody's own songs or
 * a real one. Written as syllables on a beat grid, the way an UltraStar file
 * is, and turned into the song shape the player reads.
 */

export const HELP_SONG_TITLE = 'Lanterns on the Tide';
export const HELP_SONG_ARTIST = 'Marrow Bay';

/** One syllable: its text (a trailing space ends the word), beats, MIDI note. */
type TSyllable = readonly [string, number, number];

const LYRICS: readonly (readonly TSyllable[])[] = [
  [
    ['Hang ', 2, 62],
    ['the ', 1, 62],
    ['lan', 2, 64],
    ['terns ', 1, 67],
    ['on ', 1, 66],
    ['the ', 1, 64],
    ['tide', 4, 62],
  ],
  [
    ['Let ', 2, 60],
    ['the ', 1, 62],
    ['har', 2, 64],
    ['bour ', 1, 64],
    ['car', 2, 67],
    ['ry ', 1, 69],
    ['light', 4, 67],
  ],
  [
    ['Ev', 1, 69],
    ['ery ', 1, 67],
    ['wave ', 2, 66],
    ['a ', 1, 64],
    ['lit', 2, 66],
    ['tle ', 1, 67],
    ['song', 4, 69],
  ],
  [
    ['Sing ', 2, 71],
    ['it ', 1, 69],
    ['back ', 2, 67],
    ['and ', 1, 66],
    ['sing ', 2, 64],
    ['a', 1, 62],
    ['long', 4, 64],
  ],
  [
    ['Hold ', 2, 62],
    ['the ', 1, 64],
    ['rope ', 2, 66],
    ['and ', 1, 67],
    ['pull ', 2, 69],
    ['it ', 1, 67],
    ['in', 4, 66],
  ],
  [
    ['Morn', 2, 64],
    ['ing ', 1, 62],
    ['finds ', 2, 64],
    ['us ', 1, 66],
    ['here ', 2, 67],
    ['a', 1, 66],
    ['gain', 4, 62],
  ],
];

const BEAT_MS = 500;
/** The silence a syllable leaves before the next. */
const BREATH_MS = 40;
const FIRST_LINE_MS = 2_000;
const LINE_EVERY_MS = 9_000;

export const HELP_SONG_DURATION_MS = 58_000;

const lines: IKaraokeLine[] = LYRICS.map((syllables, lineIndex) => {
  let beat = 0;
  const tokens = syllables.map(([text, beats, midi], index) => {
    const startMs = FIRST_LINE_MS + lineIndex * LINE_EVERY_MS + beat * BEAT_MS;
    beat += beats;
    return {
      text,
      startsWord: index === 0 || syllables[index - 1][0].endsWith(' '),
      startMs,
      endMs: startMs + beats * BEAT_MS - BREATH_MS,
      targetMidi: midi,
    };
  });
  return {
    id: `help-line-${lineIndex}`,
    startMs: tokens[0].startMs,
    endMs: tokens[tokens.length - 1].endMs,
    tokens,
  };
});

const CHORD_NAMES = ['G', 'Em', 'C', 'D', 'G', 'Bm', 'Cmaj7', 'D7'];
const CHORD_MS = 2_250;

const chords: IKaraokeChordSegment[] = Array.from(
  { length: Math.ceil(HELP_SONG_DURATION_MS / CHORD_MS) },
  (_, index) => ({
    startMs: index * CHORD_MS,
    endMs: (index + 1) * CHORD_MS,
    label: CHORD_NAMES[index % CHORD_NAMES.length],
    confidence: 1,
  }),
);

export const HELP_CHORDS: readonly IKaraokeChordSegment[] = chords;

export const HELP_SONG: IKaraokeSong = {
  id: 'help-karaoke-song',
  title: HELP_SONG_TITLE,
  artist: HELP_SONG_ARTIST,
  durationMs: HELP_SONG_DURATION_MS,
  assets: [],
  timingPrecision: 'syllable',
  lines,
  chords,
  pitch: {
    kind: 'notes',
    source: 'ultrastar',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'nearest-target',
    notes: lines.flatMap((line) => line.tokens),
  },
  meta: { sourceFormat: 'ultrastar', gapMs: FIRST_LINE_MS, language: 'en' },
};

/** Where the stage is: on "lit" of the third line, half of it sung. */
export const HELP_PLAYHEAD_MS =
  FIRST_LINE_MS + 2 * LINE_EVERY_MS + 5 * BEAT_MS + 480;

/**
 * How far off each sung note was, in cents, and the verdict it earned. The
 * first two lines and the start of the third are sung; a flat "wave" and a
 * late "light" so the strip and the lines show more than one colour.
 */
const SUNG: readonly (readonly [number, TKaraokeVerdict])[] = [
  [6, 'perfect'],
  [12, 'perfect'],
  [-18, 'good'],
  [9, 'perfect'],
  [4, 'perfect'],
  [-8, 'perfect'],
  [15, 'good'],
  [-10, 'perfect'],
  [22, 'good'],
  [-35, 'low'],
  [5, 'perfect'],
  [8, 'perfect'],
  [-12, 'perfect'],
  [28, 'late'],
  [8, 'perfect'],
  [-16, 'good'],
  [-72, 'low'],
  [10, 'perfect'],
];

/** How much of a note's share each verdict keeps, roughly as the judge does. */
const CREDIT: Record<TKaraokeVerdict, number> = {
  perfect: 1,
  good: 0.75,
  late: 0.55,
  low: 0.35,
  high: 0.35,
  missed: 0,
  skipped: 0,
};

const toResult = (
  sheet: IKaraokeScoreSheet,
  index: number,
  [meanCents, verdict]: readonly [number, TKaraokeVerdict],
): IKaraokeNoteResult => {
  const note = sheet.notes[index];
  const credit = CREDIT[verdict];
  const lengthMs = note.endMs - note.startMs;
  return {
    verdict,
    credit,
    points: (credit * note.weight * KARAOKE_SCORE_MAX) / sheet.totalWeight,
    octave: false,
    onTime: verdict !== 'late',
    meanCents,
    voicedMs: lengthMs,
    inTuneMs: Math.abs(meanCents) <= 50 ? lengthMs * 0.9 : lengthMs * 0.3,
  };
};

const sheetOf = (song: IKaraokeSong): IKaraokeScoreSheet => {
  const sheet = buildKaraokeScoreSheet(song.pitch, song.lines);
  if (!sheet) {
    throw new Error('The help song has no notes to score.');
  }
  return sheet;
};

export const HELP_SHEET = sheetOf(HELP_SONG);

/** The run as it stands at the playhead: the notes before it judged. */
export const HELP_RESULTS_SO_FAR: (IKaraokeNoteResult | undefined)[] =
  HELP_SHEET.notes.map((_, index) =>
    index < SUNG.length ? toResult(HELP_SHEET, index, SUNG[index]) : undefined,
  );

/** The note being sung at the playhead. */
export const HELP_FIRST_OPEN = SUNG.length;

/**
 * The whole song sung, for the card at its end: the start as above, then
 * the rest, with one line that went flat and one sung late.
 */
const REST: readonly (readonly [number, TKaraokeVerdict])[] = [
  [6, 'perfect'],
  [10, 'perfect'],
  [-14, 'perfect'],
  [7, 'perfect'],
  [18, 'good'],
  [-40, 'low'],
  [-46, 'low'],
  [-58, 'low'],
  [9, 'perfect'],
  [12, 'perfect'],
  [3, 'perfect'],
  [-6, 'perfect'],
  [24, 'good'],
  [5, 'perfect'],
  [8, 'perfect'],
  [30, 'late'],
  [12, 'perfect'],
  [-9, 'perfect'],
  [36, 'late'],
  [14, 'good'],
  [4, 'perfect'],
  [7, 'perfect'],
  [-11, 'perfect'],
  [10, 'perfect'],
];

export const HELP_RESULTS_WHOLE: IKaraokeNoteResult[] = HELP_SHEET.notes.map(
  (_, index) =>
    toResult(
      HELP_SHEET,
      index,
      index < SUNG.length ? SUNG[index] : REST[index - SUNG.length],
    ),
);

/** A note's verdict on the strip, by the note itself. */
export const helpVerdictOf = (note: { startMs?: number }) => {
  const index = HELP_SHEET.notes.findIndex(
    (scored) => scored.startMs === note.startMs,
  );
  const result = index >= 0 ? HELP_RESULTS_SO_FAR[index] : undefined;
  // Judged long ago, so its chip stands whole rather than arriving.
  return result && { verdict: result.verdict, octave: false, judgedAt: 0 };
};

const SAMPLE_EVERY_MS = 50;

/** How far off the note being sung at the playhead is, in cents. */
export const HELP_SINGING_CENTS = 8;

/** The note being sung at the playhead, as the microphone hears it. */
export const HELP_SINGING_MIDI =
  (HELP_SHEET.notes[HELP_FIRST_OPEN]?.targetMidi ?? 64) +
  HELP_SINGING_CENTS / 100;

/**
 * The singer's voice up to the playhead, one sample every 50 ms as the lane
 * keeps them: on each note at its cents off, a breath of silence between
 * notes, and a level that swells through each one.
 */
export const HELP_TRACE: IKaraokePitchPoint[] = (() => {
  const points: IKaraokePitchPoint[] = [];
  for (
    let songTimeMs = HELP_PLAYHEAD_MS - 1_600;
    songTimeMs <= HELP_PLAYHEAD_MS;
    songTimeMs += SAMPLE_EVERY_MS
  ) {
    const index = HELP_SHEET.notes.findIndex(
      (note) => note.startMs <= songTimeMs && note.endMs > songTimeMs,
    );
    const note = index >= 0 ? HELP_SHEET.notes[index] : undefined;
    const cents =
      index >= 0 && index < SUNG.length ? SUNG[index][0] : HELP_SINGING_CENTS;
    const through = note
      ? (songTimeMs - note.startMs) / (note.endMs - note.startMs)
      : 0;
    points.push({
      midi: (note?.targetMidi ?? 64) + cents / 100,
      songTimeMs,
      wallTimeMs: songTimeMs,
      energy: note ? 0.12 + 0.08 * Math.sin(Math.PI * through) : 0,
      confidence: note ? 0.9 : 0,
      voiced: Boolean(note),
    });
  }
  return points;
})();

/** A loudness overview of the song, as the Maker's analysis leaves one. */
const WAVEFORM_POINTS = 640;
const waveform = Array.from({ length: WAVEFORM_POINTS }, (_, index) => {
  const timeMs = (index / WAVEFORM_POINTS) * HELP_SONG_DURATION_MS;
  const sung = lines.some(
    (line) =>
      line.startMs !== undefined &&
      line.endMs !== undefined &&
      timeMs >= line.startMs &&
      timeMs <= line.endMs,
  );
  const beat = (timeMs % BEAT_MS) / BEAT_MS;
  const body = sung ? 0.62 : 0.34;
  return Math.min(
    1,
    body * (0.72 + 0.28 * Math.cos(beat * Math.PI * 2)) +
      0.06 * Math.sin(index * 0.7),
  );
});

/**
 * The song opened in the Maker, with its overview analysed and the words of
 * the first two lines already checked by hand.
 */
export const HELP_MAKER_PROJECT: IKaraokeMakerProject = (() => {
  const project = createKaraokeMakerProject(HELP_SONG);
  return {
    ...project,
    analysis: { waveform },
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line, lineIndex) =>
        lineIndex < 2
          ? {
              ...line,
              tokens: line.tokens.map((token) => ({
                ...token,
                timingLocked: true,
              })),
            }
          : line,
      ),
    },
  };
})();
