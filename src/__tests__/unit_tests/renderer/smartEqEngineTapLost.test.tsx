/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { getSmartEqPreview } from 'renderer/utils/smartEqPreview';
import { measureSource } from 'renderer/audio/smartEqMeasurement';

/**
 * A running Smart correction whose tap on the source fails must stop saying
 * it is listening. It did not: the graph's chip and the panel read
 * "Listening" for the rest of the song over a measurement that had already
 * ended, which on the Library looked like a correction that never holds
 * (2026-11-20). The control is the same engine over a tap that stays open,
 * which goes on listening.
 */

jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    smartEq: undefined,
    setSmartEq: () => undefined,
    getBandSetGeneration: () => 0,
    bypassed: [],
  }),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setSmartEq: () => Promise.resolve(),
}));
jest.mock('renderer/audio/songEqSession', () => ({
  noteSmartEqWrite: () => undefined,
}));
jest.mock('renderer/audio/nowPlayingIdentity', () => ({
  useNowPlayingIdentity: () => ({ identity: { key: 'song' }, isPlaying: true }),
}));
jest.mock('renderer/audio/playbackOwner', () => ({
  usePlaybackOwner: () => 'library',
}));
jest.mock('renderer/audio/transportSource', () => ({
  useLastPlayingOwner: () => 'library',
}));
jest.mock('renderer/utils/continuousEq', () => ({
  useContinuousEq: () => true,
  setContinuousEq: () => undefined,
}));
jest.mock('renderer/utils/smartEqMode', () => ({
  ...jest.requireActual('renderer/utils/smartEqMode'),
  useSmartEqMode: () => 'target',
}));
jest.mock('renderer/audio/smartEqMeasurement', () => ({
  measureSource: jest.fn(),
}));

const measure = measureSource as jest.MockedFunction<typeof measureSource>;

const openTap = (done: Promise<never>) =>
  measure.mockReturnValue({
    done,
    setSilent: () => undefined,
    restart: () => undefined,
  });

describe('Smart correction over a tap that fails', () => {
  afterEach(() => {
    measure.mockReset();
  });

  it('keeps listening while the tap stays open (control)', async () => {
    openTap(
      new Promise<never>(() => {
        // Never settles: the tap stays open.
      }),
    );
    const { unmount } = render(<SmartEqEngine />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(measure).toHaveBeenCalledTimes(1);
    expect(getSmartEqPreview().phase).toBe('listening');
    unmount();
  });

  it('stops listening once the tap is lost', async () => {
    let lose: (reason: Error) => void = () => undefined;
    openTap(
      new Promise<never>((_resolve, reject) => {
        lose = reject;
      }),
    );
    const { unmount } = render(<SmartEqEngine />);
    expect(getSmartEqPreview().phase).toBe('listening');
    await act(async () => {
      lose(new Error('eq.smart.error.noSource'));
      await Promise.resolve();
    });
    expect(getSmartEqPreview().phase).toBe('idle');
    unmount();
  });
});
