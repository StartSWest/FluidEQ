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
  PITCH_LABEL_CLEARANCE_PX,
  pitchLaneLayout,
  PLOT_LEFT,
  PLOT_RIGHT,
} from '../../renderer/karaoke/karaokePitchGeometry';

/**
 * The lane's whole output is canvas pixels, so a test that renders the
 * component and queries the DOM proves nothing about it — every UI defect this
 * project shipped passed that kind of test. This one records the draw calls
 * the component actually makes and measures the result.
 *
 * The two circles it looks for are unambiguous by radius: the playhead's cap
 * dot is 3.5, the head of the singer's trace is 1.8, and nothing else on the
 * canvas draws an arc at either size.
 */
const PLAYHEAD_DOT_RADIUS = 3.5;
const TRACE_HEAD_RADIUS = 1.8;
const CANVAS_WIDTH = 1_060;
const CANVAS_HEIGHT = 300;

interface IDrawOp {
  op: string;
  args: number[];
}

const createRecordingContext = () => {
  const ops: IDrawOp[] = [];
  const gradient = { addColorStop: () => undefined };
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      ops.push({
        op,
        args: args.filter(
          (argument): argument is number => typeof argument === 'number',
        ),
      });
    };
  return {
    ops,
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
  const context = createRecordingContext();
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

  it('draws the head of the trace on the cursor for a song with no notes', () => {
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

    const [playheadX] = circleXsAtRadius(ops, PLAYHEAD_DOT_RADIUS);
    const traceHeadXs = circleXsAtRadius(ops, TRACE_HEAD_RADIUS);

    expect(playheadX).toBeDefined();
    expect(traceHeadXs).toHaveLength(1);
    expect(traceHeadXs[0]).toBeCloseTo(playheadX, 6);
    // The control: the right-hand edge is where the head used to be drawn, and
    // it is 800 pixels from the cursor on this canvas.
    expect(rightEdgeX - playheadX).toBeCloseTo(800, 6);
  });

  it('draws the head of the trace on the cursor for a song with notes', () => {
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

    const [playheadX] = circleXsAtRadius(ops, PLAYHEAD_DOT_RADIUS);
    const traceHeadXs = circleXsAtRadius(ops, TRACE_HEAD_RADIUS);

    expect(traceHeadXs).toHaveLength(1);
    expect(traceHeadXs[0]).toBeCloseTo(playheadX, 6);
  });

  it('holds the trace inside the plot instead of over the pitch labels', () => {
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
    // layout, so it is clipped to the plot before it is stroked.
    const clipRects = ops.filter((entry) => entry.op === 'rect');
    expect(clipRects).toHaveLength(1);
    expect(clipRects[0].args[0]).toBe(PLOT_LEFT);
    expect(clipRects[0].args[2]).toBe(plotWidth);
    expect(ops.filter((entry) => entry.op === 'clip')).toHaveLength(1);
  });

  it('leaves out the ruler and the cursor when no song is loaded', () => {
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

    // A second ruler and a playhead belong to a song. With none open they were
    // counting out a track that was never opened.
    expect(circleXsAtRadius(ops, PLAYHEAD_DOT_RADIUS)).toHaveLength(0);
    expect(ops.some((entry) => entry.op === 'fillText')).toBe(true);
    // Under the plot and inside it is where the seconds are written; the
    // semitone names are beside the plot, in the left gutter, and one of them
    // sits at its foot. Asking for the whole bottom band instead read the
    // lowest semitone name as a clock the moment a song with no target notes
    // was given the room the word lanes no longer need (`pitchLaneLayout`).
    const { plotTop, plotBottom } = pitchLaneLayout(CANVAS_HEIGHT, false);
    const underThePlot = CANVAS_HEIGHT - plotBottom;
    expect(underThePlot).toBeGreaterThan(plotTop);
    const timeLabels = ops.filter(
      (entry) =>
        entry.op === 'fillText' &&
        entry.args[1] > underThePlot &&
        entry.args[0] >= PLOT_LEFT,
    );
    expect(timeLabels).toHaveLength(0);
  });

  it('POSITIVE CONTROL: the same band holds the seconds once a song is open', () => {
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

    const { plotBottom } = pitchLaneLayout(CANVAS_HEIGHT, false);
    const timeLabels = ops.filter(
      (entry) =>
        entry.op === 'fillText' &&
        entry.args[1] > CANVAS_HEIGHT - plotBottom &&
        entry.args[0] >= PLOT_LEFT,
    );
    expect(timeLabels.length).toBeGreaterThan(1);
  });

  /**
   * The lane is as short as 71px on a laptop-height window with the response
   * graph docked under it, and every semitone name was printed whatever the
   * room: five of them landed inside fourteen pixels, one on top of another,
   * with the plot itself a pixel tall (measured at 1440x852, 2026-09-23).
   */
  it('thins the semitone names rather than stacking them in a short lane', () => {
    const ops = drawOneFrame(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        pitch={pitch}
        playheadMs={4_000}
        durationMs={200_000}
      />,
      71,
    );

    // The names stand in the gutter to the left of the plot; everything else
    // this lane writes is inside it.
    const nameYs = ops
      .filter((entry) => entry.op === 'fillText' && entry.args[0] < PLOT_LEFT)
      .map((entry) => entry.args[1])
      .sort((left, right) => left - right);
    expect(nameYs.length).toBeGreaterThan(0);
    const closest = nameYs
      .slice(1)
      .reduce(
        (nearest, y, index) => Math.min(nearest, y - nameYs[index]),
        Number.POSITIVE_INFINITY,
      );
    expect(closest).toBeGreaterThanOrEqual(PITCH_LABEL_CLEARANCE_PX);
  });

  it('POSITIVE CONTROL: a tall lane still names every octave it crosses', () => {
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

    const names = ops.filter(
      (entry) => entry.op === 'fillText' && entry.args[0] < PLOT_LEFT,
    );
    expect(names.length).toBeGreaterThan(3);
  });
});
