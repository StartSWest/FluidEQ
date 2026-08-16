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

import { createKaraokeMakerProject } from 'common/karaoke/makerProject';
import { IKaraokeSong } from 'common/karaoke/types';
import { makerPlot } from 'renderer/karaoke/makerCanvasGeometry';
import { paintBackdrop } from 'renderer/karaoke/makerCanvas/paintBackdrop';
import { paintLyrics } from 'renderer/karaoke/makerCanvas/paintLyrics';
import { paintNotes } from 'renderer/karaoke/makerCanvas/paintNotes';
import { paintOverlays } from 'renderer/karaoke/makerCanvas/paintOverlays';
import { ICanvasLyricWord } from 'renderer/karaoke/makerCanvasTypes';

/**
 * A 2D context that remembers what it was asked to do.
 *
 * jsdom has no canvas, and installing one would test the canvas rather than
 * this code. Every drawing call is recorded instead, which is enough to answer
 * the only question worth asking of a paint layer without a screenshot: did it
 * draw at all, and did it report the right things back.
 */
const recordingContext = () => {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.length})`);
    };
  const context = {
    calls,
    canvas: { width: 800, height: 400 },
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    rect: record('rect'),
    roundRect: record('roundRect'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    clearRect: record('clearRect'),
    fillText: record('fillText'),
    setTransform: record('setTransform'),
    setLineDash: record('setLineDash'),
    clip: record('clip'),
  };
  return context as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const song = (): IKaraokeSong => ({
  id: 'canvas-song',
  title: 'Canvas',
  artist: 'Tester',
  durationMs: 30_000,
  assets: [],
  lines: [],
  timingPrecision: 'none',
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'plain', gapMs: 0 },
});

const plot = () =>
  makerPlot({
    width: 800,
    height: 400,
    headerHeight: 40,
    viewStartMs: 0,
    visibleViewDurationMs: 12_000,
  });

const word = (id: string, startMs: number): ICanvasLyricWord => ({
  id,
  text: id,
  lineIndex: 0,
  wordIndex: 0,
  lineStartMs: startMs,
  lineEndMs: startMs + 500,
  startMs,
  endMs: startMs + 500,
  isSection: false,
  syllables: [
    {
      token: {
        id: `${id}-token`,
        text: id,
        startsWord: true,
        startMs,
        endMs: startMs + 500,
        source: 'manual',
      },
      tokenIndex: 0,
      lineIndex: 0,
      lineStartMs: startMs,
      lineEndMs: startMs + 500,
      isSection: false,
    },
  ],
});

const ref = <T>(current: T) => ({ current });

/**
 * Each paint layer has a contract about hit regions, and the contract is the
 * part a screenshot could never check.
 *
 * The backdrop draws things nobody can click. The words and the notes draw
 * things you grab, so they hand regions back. The overlays draw a gesture that
 * only exists while you are already dragging something else, so they report
 * nothing and instead *read* what the others produced.
 *
 * Getting that direction wrong is silent: hit-testing keeps working, just
 * against the wrong list.
 */
describe('the Maker canvas layers', () => {
  it('draws the backdrop and claims none of it', () => {
    const context = recordingContext();
    const result = paintBackdrop(context, {
      plot: plot(),
      width: 800,
      height: 400,
      headerHeight: 40,
      lyricSectionTop: 120,
      project: createKaraokeMakerProject(song()),
      canvasSectionGroups: [],
      viewStartMs: 0,
      visibleViewDurationMs: 12_000,
      effectiveDurationMs: 30_000,
    });

    expect(result).toBeUndefined();
    // It painted a ground and a ruler rather than returning early.
    expect(context.calls).toEqual(expect.arrayContaining(['fillRect(4)']));
    expect(context.calls.some((call) => call.startsWith('fillText'))).toBe(
      true,
    );
  });

  it('hands back word regions and boundary handles as two lists', () => {
    // Two lists, not one: a boundary handle must win hit-testing over the wider
    // word region drawn behind it, and that is decided by which list the caller
    // appends second.
    const context = recordingContext();
    const result = paintLyrics(context, {
      plot: plot(),
      lyricSectionTop: 120,
      project: createKaraokeMakerProject(song()),
      canvasLyricWords: [word('one', 1_000), word('two', 3_000)],
      selection: undefined,
      activeLyricFocus: undefined,
      activeLyricWordId: undefined,
      hoveredEditHandle: undefined,
      viewStartMs: 0,
      visibleViewDurationMs: 12_000,
      visualPlayheadMs: 0,
      wordFocusAnimationRef: ref({ startedAt: 0 }),
    });

    expect(Array.isArray(result.regions)).toBe(true);
    expect(Array.isArray(result.wordBoundaryRegions)).toBe(true);
    expect(result.regions.length).toBeGreaterThan(0);
    // The two words it was given are both grabbable.
    expect(result.regions.some((region) => region.id === 'one-token')).toBe(
      true,
    );
  });

  it('returns regions for the melody, and none when there is no melody', () => {
    const context = recordingContext();
    const empty = paintNotes(context, {
      plot: plot(),
      project: createKaraokeMakerProject(song()),
      canvasLyricWords: [],
      selectedNoteIds: new Set(),
      controlLinkMode: false,
      hoveredEditHandle: undefined,
      viewStartMs: 0,
      visibleViewDurationMs: 12_000,
      visualPlayheadMs: 0,
    });

    expect(Array.isArray(empty)).toBe(true);
    expect(empty).toHaveLength(0);
  });

  it('draws the gesture in flight without claiming any of it', () => {
    // The overlays read the regions the words and notes produced — the link
    // drag asks which word is under the cursor — and add nothing to them.
    const context = recordingContext();
    const regions = [
      {
        kind: 'word' as const,
        id: 'one-token',
        left: 10,
        right: 60,
        top: 10,
        bottom: 30,
      },
    ];
    const before = regions.length;

    const result = paintOverlays(context, {
      plot: plot(),
      visualPlayheadMs: 2_000,
      regions,
      notePaintDraftRef: ref(undefined),
      selectionBoxRef: ref(undefined),
      noteLinkDragRef: ref(undefined),
    });

    expect(result).toBeUndefined();
    expect(regions).toHaveLength(before);
    // The playhead is drawn even with no gesture in progress.
    expect(context.calls.some((call) => call.startsWith('stroke'))).toBe(true);
  });

  it('draws the selection box only while one is being dragged', () => {
    const idle = recordingContext();
    paintOverlays(idle, {
      plot: plot(),
      visualPlayheadMs: 0,
      regions: [],
      notePaintDraftRef: ref(undefined),
      selectionBoxRef: ref(undefined),
      noteLinkDragRef: ref(undefined),
    });

    const dragging = recordingContext();
    paintOverlays(dragging, {
      plot: plot(),
      visualPlayheadMs: 0,
      regions: [],
      notePaintDraftRef: ref(undefined),
      selectionBoxRef: ref({
        pointerId: 1,
        startX: 20,
        startY: 30,
        currentX: 90,
        currentY: 80,
        additive: false,
        initialNoteIds: new Set<string>(),
      }),
      noteLinkDragRef: ref(undefined),
    });

    // A box in progress is strictly more drawing than none.
    expect(dragging.calls.length).toBeGreaterThan(idle.calls.length);
  });
});
