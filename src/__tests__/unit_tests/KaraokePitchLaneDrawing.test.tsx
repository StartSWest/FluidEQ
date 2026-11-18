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

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import KaraokePitchLane from '../../renderer/karaoke/KaraokePitchLane';
import { IKaraokeLivePitch } from '../../renderer/karaoke/useKaraokeMicrophone';
import {
  PLOT_LEFT,
  PLOT_RIGHT,
} from '../../renderer/karaoke/karaokePitchGeometry';

/**
 * The lane's whole output is canvas pixels, so a test that renders the
 * component and queries the DOM proves nothing about it — every UI defect this
 * project shipped passed that kind of test. This one records the draw calls
 * the component actually makes and measures the result.
 *
 * The strip is the E mockup's since 2026-11-16: the playhead a plain line
 * through the whole strip, the head of the singer's line a ring with a 1.9px
 * dot in it, which nothing else on the canvas draws at that size, and the
 * note names in the gutter left of the plot.
 */
const TRACE_HEAD_RADIUS = 1.9;
const CANVAS_WIDTH = 1_060;
const CANVAS_HEIGHT = 300;

interface IDrawOp {
  op: string;
  args: number[];
  /** A text drawn, and the font it was drawn in. */
  text?: string;
  font?: string;
}

const createRecordingContext = (canvasHeight: number) => {
  const ops: IDrawOp[] = [];
  const gradient = { addColorStop: () => undefined };
  const state = { font: '' };
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      const [first] = args;
      ops.push({
        op,
        args: args.filter(
          (argument): argument is number => typeof argument === 'number',
        ),
        ...(typeof first === 'string' ? { text: first, font: state.font } : {}),
      });
    };
  return {
    ops,
    // The note boxes clip to the canvas's own height.
    canvas: { width: CANVAS_WIDTH, height: canvasHeight },
    get font() {
      return state.font;
    },
    set font(next: string) {
      state.font = next;
    },
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    arcTo: record('arcTo'),
    rect: record('rect'),
    // The note boxes (`makerCanvasGeometry`'s rounded box).
    roundRect: record('roundRect'),
    clip: record('clip'),
    fill: record('fill'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    setLineDash: record('setLineDash'),
    fillText: record('fillText'),
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (text: string) => ({ width: text.length * 5 }),
  };
};

/** Circle centres drawn at exactly this radius, in draw order. */
const circleXsAtRadius = (ops: readonly IDrawOp[], radius: number): number[] =>
  ops
    .filter((entry) => entry.op === 'arc' && entry.args[2] === radius)
    .map((entry) => entry.args[0]);

/** The playhead: a line from the strip's top straight down to its foot. */
const playheadXs = (ops: readonly IDrawOp[]): number[] =>
  ops.flatMap((entry, index) => {
    const next = ops[index + 1];
    return entry.op === 'moveTo' &&
      entry.args[1] === 0 &&
      next?.op === 'lineTo' &&
      next.args[0] === entry.args[0] &&
      next.args[1] > 0
      ? [entry.args[0]]
      : [];
  });

/** The note names written in the gutter, left of the plot. */
const gutterNames = (ops: readonly IDrawOp[]) =>
  ops
    .filter(
      (entry) =>
        entry.op === 'fillText' &&
        entry.text !== undefined &&
        entry.args[0] < PLOT_LEFT,
    )
    .map((entry) => ({
      text: entry.text ?? '',
      y: entry.args[1],
      font: entry.font ?? '',
    }));

const pitch: IKaraokeLivePitch = {
  frequencyHz: 440,
  midi: 69,
  note: 'A4',
  cents: 0,
  confidence: 0.98,
  rms: 0.2,
  capturedAtMs: 1,
  processingMs: 1,
};

const ultraStarTarget = {
  kind: 'notes' as const,
  source: 'ultrastar',
  coordinateSystem: 'midi-semitones' as const,
  octavePolicy: 'absolute' as const,
  notes: [
    {
      text: 'sing',
      startsWord: true,
      startMs: 3_800,
      endMs: 5_200,
      targetMidi: 69,
    },
  ],
};

/**
 * Render the lane, run exactly one frame, and hand back what it drew.
 *
 * `requestAnimationFrame` is stubbed to schedule nothing — left alone, the
 * component's own loop would redraw forever inside the test. The single frame
 * is driven through the ResizeObserver callback the component registers,
 * which is the same `draw` the loop calls.
 */
const drawOneFrame = (
  element: Parameters<typeof render>[0],
  canvasHeight: number = CANVAS_HEIGHT,
): readonly IDrawOp[] => {
  const context = createRecordingContext(canvasHeight);
  let drawFrame: (() => void) | undefined;

  const StubResizeObserver = jest
    .fn()
    .mockImplementation((callback: () => void) => {
      drawFrame = callback;
      return {
        observe: () => undefined,
        unobserve: () => undefined,
        disconnect: () => undefined,
      };
    });

  const previousObserver = window.ResizeObserver;
  const getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const rectSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: CANVAS_WIDTH,
      bottom: canvasHeight,
      width: CANVAS_WIDTH,
      height: canvasHeight,
      toJSON: () => ({}),
    });
  const frameSpy = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockReturnValue(0);

  window.ResizeObserver =
    StubResizeObserver as unknown as typeof ResizeObserver;
  try {
    render(element);
    act(() => {
      drawFrame?.();
    });
  } finally {
    window.ResizeObserver = previousObserver;
    getContextSpy.mockRestore();
    rectSpy.mockRestore();
    frameSpy.mockRestore();
  }
  return context.ops;
};

describe('KaraokePitchLane drawing', () => {
  const plotWidth = CANVAS_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const rightEdgeX = PLOT_LEFT + plotWidth;

  it('draws the head of the trace on the playhead for a song with no notes', () => {
    // The case that is not the exception: only an imported UltraStar chart
    // carries notes, so every other song lands here.
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        isPlaying
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        target={{ kind: 'none', reason: 'missing' }}
        playheadMs={4_000}
        durationMs={200_000}
      />,
    );

    const [playheadX] = playheadXs(ops);
    const traceHeadXs = circleXsAtRadius(ops, TRACE_HEAD_RADIUS);

    expect(playheadX).toBeDefined();
    expect(traceHeadXs).toHaveLength(1);
    // The playhead is drawn on the half pixel; the head where the time is.
    expect(Math.abs(traceHeadXs[0] - playheadX)).toBeLessThanOrEqual(1);
    // The control: the right-hand edge is where the head used to be drawn,
    // and it is 800 pixels and more from the playhead on this canvas.
    expect(rightEdgeX - playheadX).toBeGreaterThan(800);
  });

  it('draws the head of the trace on the playhead for a song with notes', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        isPlaying
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        target={ultraStarTarget}
        playheadMs={4_000}
        durationMs={200_000}
      />,
    );

    const [playheadX] = playheadXs(ops);
    const traceHeadXs = circleXsAtRadius(ops, TRACE_HEAD_RADIUS);

    expect(traceHeadXs).toHaveLength(1);
    expect(Math.abs(traceHeadXs[0] - playheadX)).toBeLessThanOrEqual(1);
  });

  it('holds the trace inside the plot instead of over the note names', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        isPlaying
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        target={{ kind: 'none', reason: 'missing' }}
        playheadMs={4_000}
        durationMs={200_000}
      />,
    );

    // The curve is the one thing here sized by a microphone rather than by the
    // layout, so it is clipped to the plot before it is stroked; the note
    // boxes are held to the plot the same way. Every clip is the plot.
    const clipRects = ops.filter((entry) => entry.op === 'rect');
    expect(clipRects.length).toBeGreaterThan(0);
    clipRects.forEach((rect) => {
      expect(rect.args[0]).toBe(PLOT_LEFT);
      expect(rect.args[2]).toBe(plotWidth);
    });
    expect(ops.filter((entry) => entry.op === 'clip')).toHaveLength(
      clipRects.length,
    );
    // The control: the trace's own clip is among them, the last one, laid
    // just before the head is drawn.
    const lastClip = ops.map((entry) => entry.op).lastIndexOf('clip');
    const head = ops.findIndex(
      (entry) => entry.op === 'arc' && entry.args[2] === TRACE_HEAD_RADIUS,
    );
    expect(head).toBeGreaterThan(lastClip);
  });

  it('draws no playhead when no song is loaded', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        playheadMs={0}
        durationMs={0}
      />,
    );
    // A playhead belongs to a song: with none open it stood on a track that
    // was never opened.
    expect(playheadXs(ops)).toHaveLength(0);
    // The control: the grid's names are drawn all the same.
    expect(ops.some((entry) => entry.op === 'fillText')).toBe(true);
  });

  it('POSITIVE CONTROL: the playhead is drawn once a song is open', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        playheadMs={4_000}
        durationMs={200_000}
      />,
    );
    expect(playheadXs(ops)).toHaveLength(1);
  });

  /**
   * The strip is as short as 76px on a short window, and every note name
   * printed whatever the room landed one on top of another. Rows under 15px
   * name only their Cs; the note at the playhead is always named.
   */
  it('names only the Cs in a short strip, never one name on another', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        playheadMs={4_000}
        durationMs={200_000}
      />,
      76,
    );

    // The names stand in the gutter to the left of the plot.
    const names = gutterNames(ops);
    expect(names.length).toBeGreaterThan(0);
    names.forEach(({ text }) => expect(text).toMatch(/^C-?\d$/));
    const ys = names.map(({ y }) => y).sort((left, right) => left - right);
    ys.slice(1).forEach((y, index) => {
      expect(y - ys[index]).toBeGreaterThanOrEqual(10);
    });
  });

  it('POSITIVE CONTROL: a tall strip names every row', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        playheadMs={4_000}
        durationMs={200_000}
      />,
      420,
    );
    const names = gutterNames(ops);
    expect(names.length).toBeGreaterThan(12);
    expect(names.some(({ text }) => !text.startsWith('C'))).toBe(true);
  });

  // The E mockup: the note at the playhead is lit in the gutter, so it says
  // which row the note being sung is on.
  it('names the note at the playhead in the gutter, in bold', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        isPlaying
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        target={ultraStarTarget}
        playheadMs={4_000}
        durationMs={200_000}
      />,
      76,
    );
    const lit = gutterNames(ops).find(({ text }) => text === 'A4');
    expect(lit).toBeDefined();
    expect(lit?.font).toMatch(/^700 /);
  });
});
