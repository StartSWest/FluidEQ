/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The live trace building its scenes' states once, not once per frame.
 *
 * Every scene's state was held as `useRef(createX())`, and the argument to
 * `useRef` is evaluated on every render whether React keeps it or not. The
 * trace renders with every analyser frame, so on the default page the space
 * invasion's 340 stars and the warp tunnel's 420 were built and thrown away
 * thirty times a second, whichever look was showing. The picture is the same
 * either way, so what is held is the count of builds.
 */

import { render } from '@testing-library/react';
import type { IChartPointData } from 'renderer/graph/ChartController';
import LiveTraceCanvas from 'renderer/graph/LiveTraceCanvas';
import { createSpaceInvasion } from 'renderer/graph/spaceInvasion';
import { createWarpTunnel } from 'renderer/graph/warpTunnel';

const mockFrame: {
  graphPoints: IChartPointData[];
  waveform: number[];
} = { graphPoints: [], waveform: [] };

jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrame: () => mockFrame,
  useLiveAudioControl: () => ({ isPaused: false }),
}));

jest.mock('renderer/graph/spaceInvasion', () => {
  const actual = jest.requireActual('renderer/graph/spaceInvasion');
  return {
    ...actual,
    createSpaceInvasion: jest.fn(actual.createSpaceInvasion),
  };
});

jest.mock('renderer/graph/warpTunnel', () => {
  const actual = jest.requireActual('renderer/graph/warpTunnel');
  return { ...actual, createWarpTunnel: jest.fn(actual.createWarpTunnel) };
});

/** A d3 scale is only ever asked for its range here. */
const scale = (from: number, to: number) =>
  Object.assign(() => 0, { range: () => [from, to] });

const trace = () => (
  <LiveTraceCanvas
    curves={[{ colour: 'currentColor', opacity: 1 }]}
    xScale={scale(0, 300) as never}
    yScale={scale(200, 0) as never}
    width={300}
    height={200}
    offsetLeft={0}
    offsetTop={0}
    isForeground
  />
);

/** A new frame from the analyser, which is what renders the trace. */
const nextFrame = (level: number) => {
  mockFrame.graphPoints = [
    { x: 100, y: level },
    { x: 1_000, y: level },
  ];
  mockFrame.waveform = [level / 100, -level / 100];
};

beforeEach(() => {
  jest.mocked(createSpaceInvasion).mockClear();
  jest.mocked(createWarpTunnel).mockClear();
});

describe("the live trace's scene states", () => {
  it('are built once per mount, however many frames arrive', () => {
    nextFrame(-40);
    const { rerender, unmount } = render(trace());
    for (let frame = 1; frame <= 30; frame += 1) {
      nextFrame(-40 + frame);
      rerender(trace());
    }
    expect(createSpaceInvasion).toHaveBeenCalledTimes(1);
    expect(createWarpTunnel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('are built afresh for a new mount', () => {
    // POSITIVE CONTROL: the count above is of real builds, and a trace that
    // comes back is given scenes of its own rather than the last one's.
    render(trace()).unmount();
    render(trace()).unmount();
    expect(createSpaceInvasion).toHaveBeenCalledTimes(2);
    expect(createWarpTunnel).toHaveBeenCalledTimes(2);
  });
});
