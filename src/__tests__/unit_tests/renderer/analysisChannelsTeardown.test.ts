/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The analysers the split, scope and mid/side views hang off the live capture.
 *
 * Taking a reader down disconnected its own outputs and never the capture's
 * edge into its splitter, so every rebuild — a look switched between Joined
 * and Left & right — left one more splitter on the live capture.
 */

import { renderHook } from '@testing-library/react';
import useAnalysisChannels from 'renderer/graph/analysis/useAnalysisChannels';

interface IFakeNode {
  connect: jest.Mock;
  disconnect: jest.Mock;
}

const fakeNode = (): IFakeNode => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
});

let mockCapture: { context: unknown; source: IFakeNode } | undefined;

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ capture: mockCapture }),
}));

let splitters: IFakeNode[];

beforeEach(() => {
  splitters = [];
  mockCapture = {
    source: fakeNode(),
    context: {
      sampleRate: 48_000,
      createChannelSplitter: () => {
        const splitter = fakeNode();
        splitters.push(splitter);
        return splitter;
      },
      createGain: () => ({ ...fakeNode(), gain: { value: 1 } }),
      createAnalyser: () => ({
        ...fakeNode(),
        fftSize: 2048,
        frequencyBinCount: 1024,
      }),
    },
  };
});

const SCOPE = { split: false, scope: true, midside: false };

it('takes the capture’s edge into its splitter down with it', () => {
  const source = mockCapture?.source;
  const view = renderHook(() => useAnalysisChannels(SCOPE));
  expect(splitters).toHaveLength(1);
  expect(source?.connect).toHaveBeenCalledWith(splitters[0]);
  view.unmount();
  expect(source?.disconnect).toHaveBeenCalledWith(splitters[0]);
  // Only its own edge: the source feeds the graph and the meters too.
  expect(source?.disconnect).toHaveBeenCalledTimes(1);
});

it('leaves one splitter on the capture however often the view is rebuilt', () => {
  const source = mockCapture?.source;
  const view = renderHook(({ needs }) => useAnalysisChannels(needs), {
    initialProps: { needs: SCOPE },
  });
  view.rerender({ needs: { ...SCOPE, midside: true } });
  view.rerender({ needs: SCOPE });
  expect(splitters).toHaveLength(3);
  expect(source?.disconnect).toHaveBeenCalledWith(splitters[0]);
  expect(source?.disconnect).toHaveBeenCalledWith(splitters[1]);
  expect(source?.disconnect).not.toHaveBeenCalledWith(splitters[2]);
});

it('is quiet when the capture already let go of everything', () => {
  const source = mockCapture?.source;
  source?.disconnect.mockImplementation(() => {
    throw new DOMException('not connected', 'InvalidAccessError');
  });
  const view = renderHook(() => useAnalysisChannels(SCOPE));
  expect(() => view.unmount()).not.toThrow();
});
