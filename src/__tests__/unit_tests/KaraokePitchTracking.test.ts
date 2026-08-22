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
  karaokeLeadNoteArticulation,
  karaokeLeadNoteShape,
} from '../../common/karaoke/melodyArticulation';
import { IKaraokeToken } from '../../common/karaoke/types';
import {
  buildKaraokeMelodyGuide,
  findKaraokePitchIssues,
  IKaraokePitchPoint,
  IKaraokeTraceAxis,
  karaokePitchSongTimeX,
  karaokeTraceBehindPlayhead,
  karaokeTraceSampleX,
  PLOT_LEFT,
  singerTargetAtTime,
  targetAtTime,
} from '../../renderer/karaoke/karaokePitchGeometry';

const PLOT_WIDTH = 1_000;
const PLAYHEAD_MS = 60_000;
const NOW_MS = 90_000;

const axis = (
  overrides: Partial<IKaraokeTraceAxis> = {},
): IKaraokeTraceAxis => ({
  playheadMs: PLAYHEAD_MS,
  nowMs: NOW_MS,
  plotWidth: PLOT_WIDTH,
  hasSongClock: true,
  usesSongTime: false,
  ...overrides,
});

/** A sample captured `ageMs` ago, with both clocks running together. */
const sample = (ageMs: number): IKaraokePitchPoint => ({
  midi: 62,
  songTimeMs: PLAYHEAD_MS - ageMs,
  wallTimeMs: NOW_MS - ageMs,
  energy: 0.2,
  confidence: 0.9,
  voiced: true,
});

const note = (
  startMs: number,
  endMs: number,
  targetMidi: number,
  kind?: 'normal' | 'golden' | 'free',
): IKaraokeToken => ({ text: 'la', startMs, endMs, targetMidi, kind });

describe('karaoke pitch lane tracking', () => {
  const cursorX = karaokePitchSongTimeX(PLAYHEAD_MS, PLAYHEAD_MS, PLOT_WIDTH);
  const rightEdgeX = PLOT_LEFT + PLOT_WIDTH;

  it('draws the newest sample on the cursor, not on the right-hand edge', () => {
    // The control that makes this test mean something: the cursor and the
    // right-hand edge are 800px apart on this plot, so anchoring to the wrong
    // one cannot pass by coincidence.
    expect(rightEdgeX - cursorX).toBe(800);

    expect(karaokeTraceSampleX(sample(0), axis())).toBe(cursorX);
    expect(karaokeTraceSampleX(sample(0), axis({ usesSongTime: true }))).toBe(
      cursorX,
    );
  });

  it('measures a sample the same on either clock while the song plays', () => {
    const oneSecondOld = sample(1_000);

    expect(karaokeTraceSampleX(oneSecondOld, axis())).toBe(
      karaokeTraceSampleX(oneSecondOld, axis({ usesSongTime: true })),
    );
    // And it agrees with the ruler, which the notes and ticks are drawn on.
    expect(karaokeTraceSampleX(oneSecondOld, axis())).toBe(
      karaokePitchSongTimeX(PLAYHEAD_MS - 1_000, PLAYHEAD_MS, PLOT_WIDTH),
    );
  });

  it('keeps trailing the cursor while the transport is paused', () => {
    // A paused song stamps every sample with the same song time, so only the
    // wall clock can still spread them out behind the cursor.
    const paused = (ageMs: number): IKaraokePitchPoint => ({
      ...sample(ageMs),
      songTimeMs: PLAYHEAD_MS,
    });

    expect(karaokeTraceSampleX(paused(0), axis())).toBe(cursorX);
    expect(karaokeTraceSampleX(paused(800), axis())).toBeLessThan(cursorX);
    expect(karaokeTraceSampleX(paused(800), axis())).toBeGreaterThan(
      karaokeTraceSampleX(paused(1_600), axis()),
    );
  });

  it('gives the bare microphone monitor the full lane when no song is loaded', () => {
    expect(karaokeTraceSampleX(sample(0), axis({ hasSongClock: false }))).toBe(
      rightEdgeX,
    );
  });

  it('drops a previous attempt recorded ahead of the cursor', () => {
    const windowStartMs = PLAYHEAD_MS - 1_600;
    const behind = sample(400);
    const atCursor = sample(0);
    // Left in the map by a rewind: sung once, at a song time the singer has
    // not reached again.
    const ahead = sample(-2_000);
    const tooOld = sample(9_000);

    const visible = karaokeTraceBehindPlayhead(
      [ahead, atCursor, behind, tooOld],
      windowStartMs,
      PLAYHEAD_MS,
    );

    expect(visible).toEqual([behind, atCursor]);
    expect(visible).not.toContain(ahead);
  });
});

describe('karaoke note attachment', () => {
  it('stays on a held note after the guide cue has let go', () => {
    const held = [note(0, 4_000, 62)];
    const guideEndMs = karaokeLeadNoteShape({
      startMs: 0,
      endMs: 4_000,
      targetMidi: 62,
    }).endMs;

    // The control: the guide really does end first, so "still attached" is a
    // different answer and not the same one twice.
    expect(guideEndMs).toBeLessThan(3_900);
    expect(targetAtTime(held, 3_900)).toBeUndefined();
    expect(singerTargetAtTime(held, 3_900)).toBe(62);
    expect(singerTargetAtTime(held, 2_000)).toBe(62);
  });

  it('holds across a join inside a phrase and lets go at a line break', () => {
    const phrase = [
      note(0, 800, 60),
      note(860, 1_600, 64),
      note(3_000, 3_800, 67),
    ];

    // The 60ms join between two syllables of one word.
    expect(singerTargetAtTime(phrase, 830)).toBe(60);
    expect(singerTargetAtTime(phrase, 900)).toBe(64);
    // Letting go a little late on the last note of the line.
    expect(singerTargetAtTime(phrase, 1_750)).toBe(64);
    // The line break itself: nothing to be near, and it must say so.
    expect(singerTargetAtTime(phrase, 2_400)).toBeUndefined();
    // Coming in a little early on the next line.
    expect(singerTargetAtTime(phrase, 2_900)).toBe(67);
  });

  it('never treats a freestyle passage as a pitch target', () => {
    const notes = [note(0, 2_000, 62, 'free'), note(2_400, 3_000, 67)];

    expect(singerTargetAtTime(notes, 1_000)).toBeUndefined();
    // Positive control beside it: a real note in the same list still answers.
    expect(singerTargetAtTime(notes, 2_600)).toBe(67);
  });

  it('never asks the singer to fix a freestyle passage', () => {
    const singing = (songTimeMs: number, midi: number): IKaraokePitchPoint => ({
      midi,
      songTimeMs,
      wallTimeMs: songTimeMs,
      energy: 0.2,
      confidence: 0.95,
      voiced: true,
    });
    // Three semitones under both notes, which is unambiguously flat.
    const points = [
      singing(200, 59),
      singing(400, 59),
      singing(600, 59),
      singing(2_600, 64),
      singing(2_700, 64),
      singing(2_800, 64),
    ];

    const issues = findKaraokePitchIssues(
      points,
      [note(0, 1_000, 62, 'free'), note(2_500, 3_000, 67)],
      'absolute',
    );

    // The positive control: the same flat singing over a real note is still
    // reported, so this is not a review that has stopped reporting anything.
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'low', startMs: 2_500 });
  });
});

describe('karaoke lead note shape', () => {
  const held = { startMs: 0, endMs: 4_000, targetMidi: 62 };

  it('draws a long note long while the audible cue stays capped', () => {
    const shape = karaokeLeadNoteShape(held);
    const cue = karaokeLeadNoteArticulation(held);

    expect(cue.durationMs).toBeLessThanOrEqual(1_450);
    expect(shape.durationMs).toBeGreaterThan(1_450);
    // Still separated from whatever comes next, rather than filling the note.
    expect(shape.endMs).toBeLessThan(held.endMs);
    expect(shape.startMs).toBe(held.startMs);
  });

  it('carries the melody guide through the whole of a held note', () => {
    const guide = buildKaraokeMelodyGuide([
      { text: 'aah', startsWord: true, ...held },
    ]);
    const lastPoint = guide[guide.length - 1];

    expect(guide.length).toBeGreaterThan(1);
    expect(lastPoint.songTimeMs).toBeGreaterThan(1_450);
    expect(lastPoint.midi).toBe(62);
  });
});
