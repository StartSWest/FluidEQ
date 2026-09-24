/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What main will accept as a preamp.
 *
 * The gate was a band's ±20 dB, so a level deep enough to cancel a published
 * headphone correction was refused outright — with a message that named -20 dB
 * as the floor — and the dial sprang back to where it was.
 */

import { ipcMain } from 'electron';
import ChannelEnum from 'common/channels';
import {
  getDefaultState,
  MAX_GAIN,
  MIN_GAIN,
  PREAMP_MIN_GAIN,
} from 'common/constants';
import { registerPreampIpc } from 'main/ipc/preamp';

jest.mock('electron', () => ({ ipcMain: { on: jest.fn() } }));
jest.mock('main/flush', () => ({ getResolvedPreAmp: jest.fn(() => -4) }));

const setup = () => {
  const state = { ...getDefaultState(), preAmp: 0, isEnabled: true };
  const handleError = jest.fn();
  jest.mocked(ipcMain.on).mockClear();
  registerPreampIpc({
    state,
    canMeasureHeadroom: () => false,
    usesNativeHeadroom: () => false,
    handleUpdate: jest.fn().mockResolvedValue(undefined),
    handleUpdateHelper: jest.fn().mockResolvedValue(undefined),
    handleError,
  });
  const handler = jest
    .mocked(ipcMain.on)
    .mock.calls.find(([channel]) => channel === ChannelEnum.SET_PREAMP)?.[1];
  if (!handler) {
    throw new Error('SET_PREAMP handler missing');
  }
  const set = (gain: number) =>
    handler({ reply: jest.fn() } as unknown as Electron.IpcMainEvent, [
      String(gain),
    ]);
  return { state, handleError, set };
};

describe('the preamp main will take', () => {
  it('accepts a level deeper than a band may go', async () => {
    const { state, handleError, set } = setup();
    await set(-45);
    expect(state.preAmp).toBe(-45);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('accepts the floor itself', async () => {
    const { state, handleError, set } = setup();
    await set(PREAMP_MIN_GAIN);
    expect(state.preAmp).toBe(PREAMP_MIN_GAIN);
    expect(handleError).not.toHaveBeenCalled();
  });

  /*
   * The positive control. Without it "nothing was refused" is
   * indistinguishable from a gate that was taken out altogether, which is
   * exactly the shape this change could have had.
   */
  it('still refuses a level past the floor, and says where the floor is', async () => {
    const { state, handleError, set } = setup();
    await set(PREAMP_MIN_GAIN - 1);
    expect(state.preAmp).toBe(0);
    expect(handleError).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.SET_PREAMP,
      expect.anything(),
      expect.stringContaining(`${PREAMP_MIN_GAIN} dB`),
      expect.anything(),
    );
    // And the message no longer names a band's floor as the preamp's.
    expect(handleError).not.toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.SET_PREAMP,
      expect.anything(),
      expect.stringContaining(`${MIN_GAIN} dB to`),
      expect.anything(),
    );
  });

  it('still refuses makeup past the ceiling', async () => {
    const { state, handleError, set } = setup();
    await set(MAX_GAIN + 1);
    expect(state.preAmp).toBe(0);
    expect(handleError).toHaveBeenCalled();
  });
});
