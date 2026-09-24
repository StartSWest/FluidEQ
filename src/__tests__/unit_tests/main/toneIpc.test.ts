/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Tone panel's message to main: three dials, or null to take the tone
 * off, and nothing else — a malformed message must never read as flat and
 * clear somebody's tone.
 */

import ChannelEnum from 'common/channels';
import { getDefaultState, IState } from 'common/constants';
import { registerLayersIpc } from 'main/ipc/layers';

type Handler = (event: { reply: jest.Mock }, args?: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
}));
jest.mock('main/registry', () => ({ getConfigPath: jest.fn() }));

const fire = async (args?: unknown) => {
  const handler = handlers.get(ChannelEnum.SET_TONE);
  if (!handler) {
    throw new Error('Missing SET_TONE handler');
  }
  await handler({ reply: jest.fn() }, args);
};

const setUp = (tone?: IState['tone']) => {
  const state: IState = { ...getDefaultState(), tone };
  const update = jest.fn().mockResolvedValue(undefined);
  const error = jest.fn();
  const applyingLayer = jest.fn();
  registerLayersIpc({
    state,
    handleUpdate: update,
    handleError: error,
    applyingLayer,
  });
  return { state, update, error, applyingLayer };
};

describe('the Tone panel’s message', () => {
  it('sets the dials, bounded, and saves them with the profile', async () => {
    const { state, update, error, applyingLayer } = setUp();
    await fire([{ bass: 40, mid: 1.26, treble: -3 }]);
    expect(state.tone).toEqual({ bass: 16, mid: 1.3, treble: -3 });
    expect(applyingLayer).toHaveBeenCalledWith('tone');
    expect(error).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.SET_TONE,
      false,
      true,
    );
  });

  it('takes the tone off on null, and on three zeros', async () => {
    const { state } = setUp({ bass: 4, mid: 0, treble: 0 });
    await fire([null]);
    expect(state.tone).toBeUndefined();
    state.tone = { bass: 4, mid: 0, treble: 0 };
    await fire([{ bass: 0, mid: 0, treble: 0 }]);
    expect(state.tone).toBeUndefined();
  });

  it.each([
    undefined,
    [],
    [{ bass: 1, mid: 0 }],
    [{ bass: Number.NaN, mid: 0, treble: 0 }],
    [{ bass: '3', mid: 0, treble: 0 }],
    ['loud'],
  ])('refuses %p and keeps the tone', async (args) => {
    const tone = { bass: 4, mid: 0, treble: 0 };
    const { state, update, error } = setUp(tone);
    await fire(args);
    expect(state.tone).toBe(tone);
    expect(error).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });
});
