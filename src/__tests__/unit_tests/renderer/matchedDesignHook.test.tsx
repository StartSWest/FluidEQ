/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph draws the matched shape only over an engine that plays it, and
 * finds that out without asking main again.
 *
 * `useMatchedDesign` reads the answer the window already holds. Asking on
 * every mount would run the engine helper and a registry probe each time the
 * graph's page opens; drawing matched over Equalizer APO, or over a FluidEQ
 * Engine older than 1.13, would show treble up to 3 dB fuller than it plays.
 */

import { act, render } from '@testing-library/react';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { getAudioEngineStatus } from '../../../renderer/utils/audioEngineApi';
import {
  refreshAudioEngineStatus,
  resetAudioEngineStatus,
  useAudioEngineStatus,
} from '../../../renderer/utils/useAudioEngineStatus';
import useMatchedDesign from '../../../renderer/graph/useMatchedDesign';

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  getAudioEngineStatus: jest.fn(),
}));

jest.mock('../../../renderer/dsp/systemChain', () => ({
  resetSystemDspChain: jest.fn(),
  retrySystemDspChain: jest.fn(),
}));

const status = (
  engine: IAudioEngineStatus['engine'],
  dllVersion?: string,
): IAudioEngineStatus => ({
  engine,
  apo: { installed: engine === 'apo' },
  fluid: { installed: engine === 'fluid', endpoints: [], dllVersion },
  fluidSupported: true,
  fluidUpdateReady: false,
});

let answers: ((next: IAudioEngineStatus) => void)[] = [];

/** What the window holds: the one hook that asks main. */
const Shell = () => {
  useAudioEngineStatus();
  return null;
};

/** The graph's question, and every answer it rendered with. */
const Graph = ({ seen }: { seen: boolean[] }) => {
  seen.push(useMatchedDesign());
  return null;
};

const land = async (next: IAudioEngineStatus) => {
  await act(async () => {
    answers[answers.length - 1](next);
  });
};

beforeEach(() => {
  resetAudioEngineStatus();
  answers = [];
  jest.mocked(getAudioEngineStatus).mockImplementation(
    () =>
      new Promise<IAudioEngineStatus>((resolve) => {
        answers.push(resolve);
      }),
  );
});

describe('useMatchedDesign', () => {
  it('draws matched only over a FluidEQ Engine that builds it', async () => {
    const seen: boolean[] = [];
    render(
      <>
        <Shell />
        <Graph seen={seen} />
      </>,
    );
    // Nothing known yet: the cookbook, which every engine can play.
    expect(seen[seen.length - 1]).toBe(false);

    await land(status('fluid', '1.13.0.0'));
    // POSITIVE CONTROL: the one answer that should turn it on does.
    expect(seen[seen.length - 1]).toBe(true);

    act(() => {
      refreshAudioEngineStatus();
    });
    await land(status('fluid', '1.12.0.0'));
    expect(seen[seen.length - 1]).toBe(false);

    act(() => {
      refreshAudioEngineStatus();
    });
    await land(status('apo', '1.13.0.0'));
    expect(seen[seen.length - 1]).toBe(false);
  });

  it('reads what the window knows without asking main again', async () => {
    render(<Shell />);
    await land(status('fluid', '1.13.0.0'));
    expect(answers).toHaveLength(1);

    const seen: boolean[] = [];
    render(<Graph seen={seen} />);
    // Right from its first frame, and no second helper run for it.
    expect(seen[0]).toBe(true);
    expect(answers).toHaveLength(1);
  });
});
