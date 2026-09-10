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

/**
 * The visualizer through silence.
 *
 * It used to take itself out of the document the moment a frame came back
 * empty, so a pause, a track change or a quiet passage blanked the plot and the
 * app looked broken rather than quiet. Only the scenery styles survived it,
 * because they were the one branch given zero-energy coordinates to draw.
 *
 * Nothing in the suite could see this: the element's absence is the bug, and an
 * absent element fails no query anybody had written. So the case is the
 * presence of the canvas with no measurement at all behind it, for a plain
 * style as well as a scenery one — and, in the same breath, that a silent frame
 * still draws at the floor rather than inventing a level to show.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { MIN_GAIN } from 'common/constants';
import { IChartPointData } from 'renderer/graph/ChartController';
import {
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  POINT_COUNT,
  SILENT_POINTS,
} from 'renderer/graph/liveSpectrumFrames';

const mockFrame: { points: IChartPointData[]; waveform: number[] } = {
  points: [],
  waveform: [],
};

jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrame: () => mockFrame,
  useLiveAudioControl: () => ({ isPaused: false }),
}));

// eslint-disable-next-line import/first
import LiveTraceCanvas from 'renderer/graph/LiveTraceCanvas';
// eslint-disable-next-line import/first
import { setGraphLook } from 'renderer/utils/graphStyle';

/** A d3 scale is only ever asked for its range here. */
const scale = (from: number, to: number) =>
  Object.assign(() => 0, { range: () => [from, to] });

const draw = (lookId: string) => {
  setGraphLook(lookId);
  return render(
    <LiveTraceCanvas
      curves={[{ colour: 'currentColor', opacity: 1 }]}
      xScale={scale(0, 300) as never}
      yScale={scale(200, 0) as never}
      width={300}
      height={200}
      offsetLeft={0}
      offsetTop={0}
      isForeground
    />,
  );
};

describe('the visualizer with nothing playing', () => {
  beforeEach(() => {
    mockFrame.points = [];
    mockFrame.waveform = [];
  });

  it('stays on the plot for a plain style, not only for scenery', () => {
    const { container, unmount } = draw('line');
    expect(container.querySelector('canvas.chart-live-canvas')).not.toBeNull();
    unmount();
  });

  it('stays on the plot for a scenery style as it always did', () => {
    const { container, unmount } = draw('truss');
    expect(container.querySelector('canvas.chart-live-canvas')).not.toBeNull();
    unmount();
  });

  it('draws silence at the floor rather than inventing a level', () => {
    // The band levels the drawing is handed have to be the analyser's own
    // minimum across its own axis. Anything above the floor would be a wave
    // moving to music that is not playing, which is worse than the blank plot
    // this replaced.
    expect(SILENT_POINTS).toHaveLength(POINT_COUNT);
    SILENT_POINTS.forEach((point) => {
      expect(point.y).toBe(MIN_GAIN);
    });
    expect(SILENT_POINTS[0].x).toBeCloseTo(MIN_FREQUENCY, 6);
    expect(SILENT_POINTS[SILENT_POINTS.length - 1].x).toBeCloseTo(
      MAX_FREQUENCY,
      6,
    );
  });
});
