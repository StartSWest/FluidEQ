/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Compact player opens down from its header when it appears, and from
 * the full app it appears out of a window that was cloaked while it changed
 * size. The opening is held while the document says the window cannot be
 * seen (`data-window-hidden`); played from the moment the column mounted, it
 * was over behind the cloak before anybody saw it.
 */

import {
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_REVEAL_CHANNEL,
} from 'common/windowMode';
import { setWindowMode } from 'renderer/player/windowModeStore';

const root = document.documentElement;
const isMarked = () => root.hasAttribute('data-window-hidden');

let answer: { resolve: (mode: string) => void; reject: (error: Error) => void };
const sent: { channel: string; isMarked: boolean }[] = [];

beforeEach(() => {
  sent.length = 0;
  root.removeAttribute('data-window-hidden');
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      platform: 'win32',
      ipcRenderer: {
        sendMessage: (channel: string) =>
          sent.push({ channel, isMarked: isMarked() }),
        setWindowMode: () =>
          new Promise<string>((resolve, reject) => {
            answer = { resolve, reject };
          }),
        // A main from before `contentSize` gives nothing to wait on.
        getWindowState: () =>
          Promise.resolve({ mode: 'player', isPinned: false }),
        on: () => () => undefined,
      },
    },
  });
});

describe('the window marked hidden for a switch', () => {
  it('is marked from before the cloak until the reveal has been asked', async () => {
    const switching = setWindowMode('player');
    expect(sent[0]).toEqual({
      channel: WINDOW_HIDE_FOR_SWITCH_CHANNEL,
      isMarked: true,
    });
    answer.resolve('player');
    // The switch resolves only once the reveal has been asked for.
    await switching;
    const reveal = sent.find((one) => one.channel === WINDOW_REVEAL_CHANNEL);
    expect(reveal?.isMarked).toBe(true);
    expect(isMarked()).toBe(false);
  });

  it('lets go of the mark when the switch is refused', async () => {
    const switching = setWindowMode('player');
    answer.reject(new Error('full screen'));
    await expect(switching).rejects.toThrow('full screen');
    expect(isMarked()).toBe(false);
  });
});
