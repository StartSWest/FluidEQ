/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import {
  LiveAudioProvider,
  useLiveAudioControl,
} from '../../../renderer/audio/LiveAudioContext';

const localFrame = { points: [{ x: 100, y: 3 }], waveform: [0.5] };
let mockSenderFrame: object | undefined;

jest.mock('../../../renderer/graph/useLiveOutputSpectrum', () => ({
  __esModule: true,
  default: () => ({
    control: {
      claim: () => () => undefined,
      isPaused: false,
      readFrame: () => localFrame,
      retry: () => Promise.resolve(true),
    },
    frame: { points: [], waveform: [] },
  }),
}));
// The hook hands back the frame it shows and a read of the next one, which a
// desktop background asks for while another PC is sending the music.
jest.mock('../../../renderer/remoteAudio/useSenderSpectrum', () => ({
  __esModule: true,
  default: () => ({
    frame: mockSenderFrame,
    readFrame: () => Promise.resolve(mockSenderFrame),
  }),
}));
jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  ...jest
    .requireActual('__tests__/utils/fluidEqHookMocks')
    .eqHooksFrom(() => ({ isEnabled: true })),
}));

const read: { current: (() => unknown) | undefined } = { current: undefined };
function Reader() {
  read.current = useLiveAudioControl().readFrame;
  return null;
}

describe('the draw-time frame', () => {
  it('is the local capture read at the moment of drawing', () => {
    mockSenderFrame = undefined;
    render(
      <LiveAudioProvider>
        <Reader />
      </LiveAudioProvider>,
    );
    expect(read.current?.()).toBe(localFrame);
  });

  // Music from another PC replaces the local capture on every drawing; a read
  // of the local analyser here would draw this PC's silence over it.
  it('stands aside while another PC is sending the music', () => {
    mockSenderFrame = { points: [{ x: 100, y: 9 }], waveform: [] };
    render(
      <LiveAudioProvider>
        <Reader />
      </LiveAudioProvider>,
    );
    expect(read.current?.()).toBeUndefined();
  });
});
