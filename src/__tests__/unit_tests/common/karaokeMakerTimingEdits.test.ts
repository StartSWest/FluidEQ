import {
  createKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  makerLinesFromPlainText,
  recordKaraokeMakerLineEntry,
  recordKaraokeMakerLineRange,
  resizeKaraokeMakerTokenBoundary,
  shiftKaraokeMakerLineTailFromToken,
  shiftKaraokeMakerTimeline,
  splitKaraokeMakerWordIntoSyllables,
} from '../../../common/karaoke/makerProject';
import {
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
} from '../../../common/karaoke/makerExport';
import { parseKaraokeText } from '../../../common/karaoke/files';
import { IKaraokeSong } from '../../../common/karaoke/types';

const audioFile = new File(['audio'], 'Artist - Song.mp3', {
  type: 'audio/mpeg',
  lastModified: 42,
});

const song = (): IKaraokeSong => ({
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  durationMs: 8_000,
  assets: [{ id: 'audio', role: 'audio', extension: 'mp3', file: audioFile }],
  timingPrecision: 'syllable',
  lines: [
    {
      id: 'line-1',
      startMs: 1_000,
      endMs: 2_000,
      tokens: [
        {
          text: 'Hel',
          startsWord: true,
          startMs: 1_000,
          endMs: 1_500,
          targetMidi: 60,
        },
        {
          text: 'lo',
          startsWord: false,
          startMs: 1_500,
          endMs: 2_000,
          targetMidi: 62,
        },
      ],
    },
  ],
  pitch: {
    kind: 'notes',
    source: 'fixture',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'absolute',
    notes: [
      { text: 'Hel', startMs: 1_000, endMs: 1_500, targetMidi: 60 },
      { text: 'lo', startMs: 1_500, endMs: 2_000, targetMidi: 62 },
    ],
  },
  meta: { sourceFormat: 'ultrastar', gapMs: 100, bpm: 120 },
});

describe('Karaoke Maker timing edits', () => {
  it('moves all timed lyrics and linked melody notes as one unit', () => {
    const project = createKaraokeMakerProject(song());
    const shifted = shiftKaraokeMakerTimeline(project, 375);

    expect(shifted.lyrics.lines[0].tokens[0]).toMatchObject({
      startMs: 1_375,
      endMs: 1_875,
    });
    expect(shifted.melody.notes[0]).toMatchObject({
      startMs: 1_375,
      endMs: 1_875,
    });
    expect(shifted.meta.gapMs).toBe(475);

    const clamped = shiftKaraokeMakerTimeline(shifted, -10_000);
    expect(clamped.lyrics.lines[0].tokens[0].startMs).toBe(0);
    expect(clamped.melody.notes[0].startMs).toBe(0);
  });

  it('records line entrances while preserving internal word rhythm', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 1_400 });
    Object.assign(firstLine.tokens[1], { startMs: 1_450, endMs: 2_000 });
    Object.assign(secondLine.tokens[0], { startMs: 4_000, endMs: 4_400 });
    Object.assign(secondLine.tokens[1], { startMs: 4_450, endMs: 5_000 });
    project.melody.notes = [
      {
        id: 'linked',
        tokenId: secondLine.tokens[0].id,
        startMs: 4_000,
        endMs: 4_400,
        targetMidi: 60,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      6_000,
      firstLine.id,
    );
    const moved = recorded.lyrics.lines[1].tokens;

    expect(moved[0]).toMatchObject({
      startMs: 6_000,
      endMs: 6_400,
      timingLocked: true,
    });
    expect(moved[1]).toMatchObject({ startMs: 6_450, endMs: 7_000 });
    expect(recorded.melody.notes[0]).toMatchObject({
      startMs: 6_000,
      endMs: 6_400,
      source: 'manual',
    });
  });

  it('keeps a recorded start exact and trims only an overlapping previous end', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 3_000 });
    Object.assign(firstLine.tokens[1], { startMs: 3_000, endMs: 5_000 });
    Object.assign(secondLine.tokens[0], { startMs: 6_000, endMs: 6_400 });
    Object.assign(secondLine.tokens[1], { startMs: 6_450, endMs: 7_000 });

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      4_000,
      firstLine.id,
    );
    const previous = recorded.lyrics.lines[0].tokens;
    const current = recorded.lyrics.lines[1].tokens;

    expect(previous[previous.length - 1].endMs).toBe(3_960);
    expect(current[0].startMs).toBe(4_000);
    expect(current[1].startMs).toBe(4_450);
  });

  it('preserves silence before an explicitly recorded start', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 15_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 2_000 });
    Object.assign(firstLine.tokens[1], { startMs: 2_000, endMs: 3_000 });
    Object.assign(secondLine.tokens[0], { startMs: 4_000, endMs: 4_400 });
    Object.assign(secondLine.tokens[1], { startMs: 4_450, endMs: 5_000 });

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      9_000,
      firstLine.id,
    );

    const previousTokens = recorded.lyrics.lines[0].tokens;
    expect(previousTokens[previousTokens.length - 1].endMs).toBe(3_000);
    expect(recorded.lyrics.lines[1].startMs).toBe(9_000);
  });

  it('pushes every overlapping later line when a recorded end moves forward', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'First line\nSecond line\nThird line',
    );
    project.lyrics.lines.forEach((line, lineIndex) => {
      line.tokens.forEach((token, tokenIndex) => {
        Object.assign(token, {
          startMs: 1_000 + lineIndex * 2_000 + tokenIndex * 400,
          endMs: 1_350 + lineIndex * 2_000 + tokenIndex * 400,
          source: 'manual',
          timingLocked: true,
        });
      });
      line.startMs = line.tokens[0].startMs;
      line.endMs = line.tokens[line.tokens.length - 1].endMs;
    });
    const [firstLine, secondLine, thirdLine] = project.lyrics.lines;

    const recorded = recordKaraokeMakerLineRange(
      project,
      firstLine.id,
      1_000,
      4_000,
    );

    expect(recorded.lyrics.lines[0].endMs).toBe(4_000);
    expect(recorded.lyrics.lines[1].startMs).toBe(4_040);
    expect(recorded.lyrics.lines[2].startMs).toBeGreaterThanOrEqual(
      (recorded.lyrics.lines[1].endMs as number) + 40,
    );
    expect(recorded.lyrics.lines[1].tokens[0].id).toBe(secondLine.tokens[0].id);
    expect(recorded.lyrics.lines[2].tokens[0].id).toBe(thirdLine.tokens[0].id);
  });

  it('keeps moved words inside a recorded line range and in reading order', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('Keep every word safe');
    const [line] = project.lyrics.lines;
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 1_000 + index * 500,
        endMs: 1_400 + index * 500,
        source: 'manual',
        timingLocked: true,
      });
    });
    line.startMs = 1_000;
    line.endMs = 2_900;

    const tooLate = shiftKaraokeMakerLineTailFromToken(
      project,
      line.tokens[1].id,
      10_000,
    );
    const lateWords = tooLate.lyrics.lines[0].tokens;
    expect(tooLate.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 2_900,
    });
    expect(lateWords[lateWords.length - 1].endMs).toBe(2_900);

    const tooEarly = shiftKaraokeMakerLineTailFromToken(
      tooLate,
      lateWords[1].id,
      -10_000,
    );
    const earlyWords = tooEarly.lyrics.lines[0].tokens;
    expect(earlyWords[1].startMs).toBe(earlyWords[0].endMs);
    earlyWords.slice(1).forEach((token, index) => {
      expect(token.startMs).toBeGreaterThanOrEqual(
        earlyWords[index].endMs as number,
      );
    });
    expect(tooEarly.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 2_900,
    });
  });

  it('fits words and linked notes inside a manually heard line range', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('Hear this line');
    const line = project.lyrics.lines[0];
    Object.assign(line.tokens[0], { startMs: 1_000, endMs: 1_300 });
    Object.assign(line.tokens[1], { startMs: 1_400, endMs: 2_000 });
    Object.assign(line.tokens[2], { startMs: 2_100, endMs: 3_000 });
    project.melody.notes = [
      {
        id: 'range-note',
        tokenId: line.tokens[2].id,
        startMs: 2_100,
        endMs: 3_000,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      5_000,
      6_000,
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words[0].startMs).toBe(5_000);
    expect(words[2].endMs).toBe(6_000);
    expect(
      words
        .slice(1)
        .every(
          (word, index) => (word.startMs ?? 0) >= (words[index].endMs ?? 0),
        ),
    ).toBe(true);
    expect(recorded.melody.notes[0]).toMatchObject({
      endMs: 6_000,
      source: 'manual',
    });
  });

  it('keeps captured word boundaries and gives a held final word the remaining line time', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 10_000;
    project.lyrics.lines = makerLinesFromPlainText('one two three held');
    const line = project.lyrics.lines[0];

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      1_000,
      6_000,
      undefined,
      [1_500, 2_100, 2_600],
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words.map(({ startMs, endMs }) => ({ startMs, endMs }))).toEqual([
      { startMs: 1_000, endMs: 1_500 },
      { startMs: 1_500, endMs: 2_100 },
      { startMs: 2_100, endMs: 2_600 },
      { startMs: 2_600, endMs: 6_000 },
    ]);
    expect((words[3].endMs as number) - (words[3].startMs as number)).toBe(
      3_400,
    );
  });

  it('repairs crossed detector timestamps into written lyric order', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const line = project.lyrics.lines[0];
    const crossed = [1_000, 2_600, 2_000, 1_700, 3_000];
    line.tokens.forEach((token, index) => {
      token.startMs = crossed[index];
      token.endMs = crossed[index] + 300;
    });

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      5_000,
      7_000,
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words.map((word) => word.text)).toEqual([
      'She',
      'leads',
      'a',
      'lonely',
      'life',
    ]);
    expect(words[0].startMs).toBe(5_000);
    expect(words[4].endMs).toBe(7_000);
    expect(
      words
        .slice(1)
        .every(
          (word, index) => (word.startMs ?? 0) >= (words[index].endMs ?? 0),
        ),
    ).toBe(true);
  });

  it('moves a selected word and the rest of its sentence without reordering', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'One two three four\nNext sentence',
    );
    const [line, nextLine] = project.lyrics.lines;
    line.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 500;
      token.endMs = 1_400 + index * 500;
    });
    nextLine.tokens.forEach((token, index) => {
      token.startMs = 4_000 + index * 500;
      token.endMs = 4_400 + index * 500;
    });
    project.melody.notes = [
      {
        id: 'tail-note',
        tokenId: line.tokens[2].id,
        startMs: 2_000,
        endMs: 2_400,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const shifted = shiftKaraokeMakerLineTailFromToken(
      project,
      line.tokens[1].id,
      300,
    );
    const words = shifted.lyrics.lines[0].tokens;

    expect(words.map((word) => word.startMs)).toEqual([
      1_000, 1_800, 2_300, 2_800,
    ]);
    expect(shifted.lyrics.lines[1].tokens[0].startMs).toBe(4_000);
    expect(shifted.melody.notes[0]).toMatchObject({
      startMs: 2_300,
      endMs: 2_700,
    });

    const clamped = shiftKaraokeMakerLineTailFromToken(
      shifted,
      words[1].id,
      -5_000,
    );
    expect(clamped.lyrics.lines[0].tokens[1].startMs).toBe(1_400);
  });

  it('resizes shared word boundaries without moving the sentence range', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('short very long');
    const line = project.lyrics.lines[0];
    line.startMs = 1_000;
    line.endMs = 4_000;
    line.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 1_000;
      token.endMs = 2_000 + index * 1_000;
      token.timingLocked = true;
    });
    project.melody.notes = [
      {
        id: 'very-note',
        tokenId: line.tokens[1].id,
        startMs: 2_250,
        endMs: 2_750,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const longerMiddle = resizeKaraokeMakerTokenBoundary(
      project,
      line.tokens[1].id,
      'end',
      3_600,
    );
    const longerWords = longerMiddle.lyrics.lines[0].tokens;
    expect(longerMiddle.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 4_000,
    });
    expect(
      longerWords.map(({ startMs, endMs }) => ({ startMs, endMs })),
    ).toEqual([
      { startMs: 1_000, endMs: 2_000 },
      { startMs: 2_000, endMs: 3_600 },
      { startMs: 3_600, endMs: 4_000 },
    ]);
    expect(longerMiddle.melody.notes[0]).toMatchObject({
      startMs: 2_400,
      endMs: 3_200,
      source: 'manual',
    });

    const earlierStart = resizeKaraokeMakerTokenBoundary(
      longerMiddle,
      longerWords[1].id,
      'start',
      1_400,
    );
    const earlierWords = earlierStart.lyrics.lines[0].tokens;
    expect(earlierWords[0].endMs).toBe(1_400);
    expect(earlierWords[1].startMs).toBe(1_400);
    expect(earlierStart.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 4_000,
    });

    const clamped = resizeKaraokeMakerTokenBoundary(
      earlierStart,
      earlierWords[1].id,
      'end',
      10_000,
    );
    expect(clamped.lyrics.lines[0].tokens[1].endMs).toBe(3_980);
    expect(clamped.lyrics.lines[0].tokens[2].startMs).toBe(3_980);
    expect(clamped.lyrics.lines[0].tokens[2].endMs).toBe(4_000);

    const expandedStart = resizeKaraokeMakerTokenBoundary(
      clamped,
      clamped.lyrics.lines[0].tokens[0].id,
      'start',
      500,
    );
    expect(expandedStart.lyrics.lines[0].startMs).toBe(500);
    expect(expandedStart.lyrics.lines[0].tokens[0].startMs).toBe(500);

    const expandedEnd = resizeKaraokeMakerTokenBoundary(
      expandedStart,
      expandedStart.lyrics.lines[0].tokens[2].id,
      'end',
      4_500,
    );
    expect(expandedEnd.lyrics.lines[0].endMs).toBe(4_500);
    expect(expandedEnd.lyrics.lines[0].tokens[2].endMs).toBe(4_500);
  });

  it('splits an attached word and its melody note into linked syllables', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('fantastic');
    const word = project.lyrics.lines[0].tokens[0];
    word.startMs = 1_000;
    word.endMs = 1_900;
    project.melody.notes = [
      {
        id: 'held-note',
        tokenId: word.id,
        startMs: 1_000,
        endMs: 1_900,
        targetMidi: 64,
        kind: 'normal',
        source: 'manual',
      },
    ];

    const split = splitKaraokeMakerWordIntoSyllables(project, word.id, 'en');
    const syllables = split.lyrics.lines[0].tokens;
    const { notes } = split.melody;

    expect(syllables.map((token) => token.text).join('')).toBe('fantastic');
    expect(syllables).toHaveLength(3);
    expect(syllables.map((token) => token.startsWord)).toEqual([
      true,
      false,
      false,
    ]);
    expect(syllables[0].id).toBe(word.id);
    expect(notes).toHaveLength(3);
    expect(notes.map((note) => note.tokenId)).toEqual(
      syllables.map((token) => token.id),
    );
    expect(notes.every((note) => note.targetMidi === 64)).toBe(true);
    expect(notes[0].startMs).toBe(1_000);
    expect(notes[notes.length - 1].endMs).toBe(1_900);
    notes.slice(1).forEach((note, index) => {
      expect(note.startMs).toBe(notes[index].endMs);
    });

    const manualSplit = splitKaraokeMakerWordIntoSyllables(
      project,
      word.id,
      'en',
      ['fan', 'ta', 'stic'],
    );
    expect(
      manualSplit.lyrics.lines[0].tokens.map((token) => token.text),
    ).toEqual(['fan', 'ta', 'stic']);
    expect(manualSplit.melody.notes.map((note) => note.tokenId)).toEqual(
      manualSplit.lyrics.lines[0].tokens.map((token) => token.id),
    );
  });

  it('imports every interoperable text format that the maker exports', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines.push({
      id: 'second-line',
      tokens: [
        {
          id: 'second-line-word',
          text: 'Again',
          startsWord: true,
          startMs: 3_000,
          endMs: 3_500,
          source: 'manual',
        },
      ],
    });
    project.melody.notes.push({
      id: 'second-line-note',
      tokenId: 'second-line-word',
      startMs: 3_000,
      endMs: 3_500,
      targetMidi: 65,
      kind: 'normal',
      source: 'manual',
    });
    const lrc = exportKaraokeMakerLrc(project, false);
    const elrc = exportKaraokeMakerLrc(project, true);
    const ultrastar = exportKaraokeMakerUltraStar(project);

    const parsedLrc = parseKaraokeText('song.lrc', lrc);
    const parsedElrc = parseKaraokeText('song.elrc', elrc);
    const parsedUltraStar = parseKaraokeText('song.txt', ultrastar);
    expect(parsedLrc).toMatchObject({
      sourceFormat: 'lrc',
      title: 'Song',
    });
    expect(parsedElrc).toMatchObject({
      sourceFormat: 'elrc',
      timingPrecision: 'word',
    });
    expect(parsedUltraStar).toMatchObject({
      sourceFormat: 'ultrastar',
      timingPrecision: 'syllable',
      pitch: { kind: 'notes' },
    });
    expect(parsedUltraStar.lines).toHaveLength(2);
    const imported = importLyricsIntoKaraokeMakerProject(
      project,
      parsedUltraStar,
    );
    expect(imported.audio).toEqual(project.audio);
    expect(imported.lyrics.lines).not.toHaveLength(0);
    expect(imported.melody.notes).not.toHaveLength(0);
  });
});
