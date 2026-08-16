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
import { paintMakerCanvas } from 'renderer/karaoke/makerCanvasPaint';
import { IHitRegion } from 'renderer/karaoke/makerCanvasGeometry';
import { ICanvasLyricWord } from 'renderer/karaoke/makerCanvasTypes';

/** Records every drawing call, since jsdom has no canvas to make them on. */
const recordingContext = () => {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.length})`);
    };
  return {
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
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const song = (): IKaraokeSong => ({
  id: 'orchestrator-song',
  title: 'Orchestrator',
  artist: 'Tester',
  durationMs: 30_000,
  assets: [],
  lines: [],
  timingPrecision: 'none',
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'plain', gapMs: 0 },
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

const paint = (words: ICanvasLyricWord[]) => {
  const context = recordingContext();
  const hitRegionsRef: { current: IHitRegion[] } = { current: [] };
  paintMakerCanvas({
    context,
    ratio: 1,
    width: 800,
    height: 400,
    headerHeight: 40,
    lyricSectionTop: 120,
    project: createKaraokeMakerProject(song()),
    selection: undefined,
    selectedNoteIds: new Set(),
    canvasLyricWords: words,
    canvasSectionGroups: [],
    activeLyricFocus: undefined,
    activeLyricWordId: undefined,
    hoveredEditHandle: undefined,
    controlLinkMode: false,
    viewStartMs: 0,
    visibleViewDurationMs: 12_000,
    visualPlayheadMs: 2_000,
    effectiveDurationMs: 30_000,
    hitRegionsRef,
    selectionBoxRef: { current: undefined },
    notePaintDraftRef: { current: undefined },
    noteLinkDragRef: { current: undefined },
    wordFocusAnimationRef: { current: { startedAt: 0 } },
  } as never);
  return { context, hitRegionsRef };
};

/**
 * The whole paint, through the entry point the component actually calls.
 *
 * The four layers are tested individually elsewhere. What only this can check
 * is that they are wired together in the right order and that what they hand
 * back reaches the ref the pointer handlers read — a layer could be perfect and
 * still be composed wrong.
 */
describe('painting the Maker canvas', () => {
  it('clears the canvas before drawing on it', () => {
    const { context } = paint([]);
    // A frame drawn over the last one without clearing leaves the previous
    // playhead and words underneath the new ones.
    expect(context.calls[0]).toBe('setTransform(6)');
    expect(context.calls[1]).toBe('clearRect(4)');
  });

  it('publishes the regions the layers produced', () => {
    // The ref is how a pointer event finds out what is under the cursor. A
    // layer returning regions that never reach it is a word you cannot click.
    const { hitRegionsRef } = paint([word('one', 1_000), word('two', 3_000)]);
    expect(hitRegionsRef.current.length).toBeGreaterThan(0);
    expect(
      hitRegionsRef.current.some((region) => region.id === 'one-token'),
    ).toBe(true);
    expect(
      hitRegionsRef.current.some((region) => region.id === 'two-token'),
    ).toBe(true);
  });

  it('replaces the regions each frame rather than appending to them', () => {
    // The list describes where things are right now. Appending would grow it
    // every frame and leave hit-testing answering from a stale layout.
    const { hitRegionsRef } = paint([word('one', 1_000)]);
    const first = hitRegionsRef.current.length;

    paintMakerCanvasAgain(hitRegionsRef);
    expect(hitRegionsRef.current.length).toBe(first);
  });

  it('reports nothing to click when there is nothing on the timeline', () => {
    const { hitRegionsRef, context } = paint([]);
    expect(hitRegionsRef.current).toHaveLength(0);
    // The stage is still drawn — an empty song is not a blank canvas.
    expect(context.calls.some((call) => call.startsWith('fillRect'))).toBe(
      true,
    );
  });
});

/** A second frame into the same ref, to prove the list is replaced. */
const paintMakerCanvasAgain = (hitRegionsRef: { current: IHitRegion[] }) => {
  const context = recordingContext();
  paintMakerCanvas({
    context,
    ratio: 1,
    width: 800,
    height: 400,
    headerHeight: 40,
    lyricSectionTop: 120,
    project: createKaraokeMakerProject(song()),
    selection: undefined,
    selectedNoteIds: new Set(),
    canvasLyricWords: [word('one', 1_000)],
    canvasSectionGroups: [],
    activeLyricFocus: undefined,
    activeLyricWordId: undefined,
    hoveredEditHandle: undefined,
    controlLinkMode: false,
    viewStartMs: 0,
    visibleViewDurationMs: 12_000,
    visualPlayheadMs: 2_000,
    effectiveDurationMs: 30_000,
    hitRegionsRef,
    selectionBoxRef: { current: undefined },
    notePaintDraftRef: { current: undefined },
    noteLinkDragRef: { current: undefined },
    wordFocusAnimationRef: { current: { startedAt: 0 } },
  } as never);
};
