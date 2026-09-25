/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player's picture onto the whole screen and back: out of sight while the
 * window changes size, back only once the page is at the window's size, and
 * the player back in view whatever the window answers or however the ask
 * fails. The picture itself is never faded — a picture faded by its own
 * opacity stopped drawing and came up frozen.
 */

import {
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_REVEAL_CHANNEL,
} from 'common/windowMode';

const mockClaim = jest.fn();
const mockHides = jest.fn(() => true);
const mockUntilWindow = jest.fn(() => Promise.resolve());

jest.mock('../../../../renderer/player/playerLayout', () => ({
  setPlayerVisFull: (next: boolean) => mockClaim(next),
}));
jest.mock('../../../../renderer/player/windowModeStore', () => ({
  afterNextFrame: () => Promise.resolve(),
  hidesWindow: () => mockHides(),
  untilViewportIsWindow: () => mockUntilWindow(),
}));

// eslint-disable-next-line import/first -- the store and layout mocks above have to be in place first.
import switchVisFullScreen from '../../../../renderer/player/visFullScreen';

interface IAnimated {
  element: Element;
  keyframes: Keyframe[];
  cancel: jest.Mock;
}

/** Every `animate` the switch asks for, on whichever element. */
const animated: IAnimated[] = [];

const deferred = <T>() => {
  let settleWith: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settleWith = resolve;
  });
  return { promise, resolve: settleWith };
};

const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 12; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

let ask: jest.Mock;
let send: jest.Mock;

const onWindows = (platform = 'win32') => {
  ask = jest.fn();
  send = jest.fn();
  window.electron = {
    platform,
    ipcRenderer: { setWindowFullScreen: ask, sendMessage: send },
  } as unknown as typeof window.electron;
};

const player = () => {
  document.body.innerHTML =
    '<div class="mini-player"><section class="player-vis"><div class="player-vis__stage"></div></section></div>';
  const root = document.querySelector('.mini-player') as HTMLElement;
  const stage = document.querySelector('.player-vis__stage') as HTMLElement;
  return { root, stage };
};

const sent = (channel: string) =>
  send.mock.calls.filter(([name]) => name === channel).length;
const covers = () => document.querySelectorAll('.mini-player__cover').length;

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: Element, keyframes: Keyframe[]) {
      const entry = { element: this, keyframes, cancel: jest.fn() };
      animated.push(entry);
      return { finished: Promise.resolve(), cancel: entry.cancel };
    },
  });
});

afterAll(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
});

beforeEach(() => {
  // The test document has no media queries; nobody here asked for less motion.
  window.matchMedia = jest.fn(() => ({
    matches: false,
  })) as unknown as typeof window.matchMedia;
  animated.length = 0;
  mockClaim.mockClear();
  mockHides.mockReset().mockReturnValue(true);
  mockUntilWindow.mockReset().mockResolvedValue(undefined);
  onWindows();
});

describe("the player's full screen", () => {
  it('goes out of sight, and comes back black at the new size with the picture fading in under a cover', async () => {
    const { root, stage } = player();
    const answer = deferred<boolean>();
    const atSize = deferred<void>();
    ask.mockReturnValue(answer.promise);
    mockUntilWindow.mockReturnValue(atSize.promise);

    const switching = switchVisFullScreen(true, stage);
    await settle();
    // Off the screen before the window is asked, and the claim written down
    // before the state the window announces can arrive.
    expect(sent(WINDOW_HIDE_FOR_SWITCH_CHANNEL)).toBe(1);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(
      ask.mock.invocationCallOrder[0],
    );
    expect(mockClaim.mock.invocationCallOrder[0]).toBeLessThan(
      ask.mock.invocationCallOrder[0],
    );
    expect(ask).toHaveBeenCalledWith(true);
    expect(covers()).toBe(1);

    // Main has moved the window, but the page has not been given the size
    // yet: still off the screen.
    answer.resolve(true);
    await settle();
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(0);

    atSize.resolve();
    await switching;
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(1);
    expect(mockClaim).toHaveBeenLastCalledWith(true);
    // The cover faded away and went; the picture was never touched.
    const lift = animated.find((entry) =>
      entry.element.classList.contains('mini-player__cover'),
    );
    expect(lift?.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(animated.some((entry) => entry.element === stage)).toBe(false);
    expect(covers()).toBe(0);
    expect(root.isConnected).toBe(true);
  });

  it('gives the player back in view when the window says no', async () => {
    const { stage } = player();
    ask.mockResolvedValue(false);
    await switchVisFullScreen(true, stage);
    expect(mockClaim).toHaveBeenLastCalledWith(false);
    expect(covers()).toBe(0);
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(1);
    expect(mockUntilWindow).not.toHaveBeenCalled();
  });

  it('gives the player back in view when the ask itself fails, and says so', async () => {
    const { stage } = player();
    ask.mockRejectedValue(new Error('bridge down'));
    await expect(switchVisFullScreen(true, stage)).rejects.toThrow(
      'bridge down',
    );
    // A cover or a cloak left behind was a black window, or none at all.
    expect(mockClaim).toHaveBeenLastCalledWith(false);
    expect(covers()).toBe(0);
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(1);
  });

  it('comes back as the player only once the page has the size main put it back to', async () => {
    const { stage } = player();
    const atSize = deferred<void>();
    ask.mockResolvedValue(false);
    mockUntilWindow.mockReturnValue(atSize.promise);

    const switching = switchVisFullScreen(false, stage);
    await settle();
    expect(ask).toHaveBeenCalledWith(false);
    // Never laid out as the player at the screen's size.
    expect(mockClaim).not.toHaveBeenCalled();
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(0);

    atSize.resolve();
    await switching;
    expect(mockClaim).toHaveBeenLastCalledWith(false);
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(1);
  });

  it('keeps the picture on a full screen the listener chose, and the window in view', async () => {
    const { stage } = player();
    // Main's answer: still full screen.
    ask.mockResolvedValue(true);
    await switchVisFullScreen(false, stage);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(sent(WINDOW_REVEAL_CHANNEL)).toBe(1);
  });

  it('ignores a second press while one change is under way', async () => {
    const { stage } = player();
    const answer = deferred<boolean>();
    ask.mockReturnValue(answer.promise);
    const first = switchVisFullScreen(true, stage);
    await switchVisFullScreen(true, stage);
    expect(ask).toHaveBeenCalledTimes(1);
    answer.resolve(true);
    await first;
  });

  it('darkens the page instead where the window cannot be taken off the screen', async () => {
    const { root, stage } = player();
    mockHides.mockReturnValue(false);
    ask.mockResolvedValue(true);
    await switchVisFullScreen(true, stage);
    const dark = animated.find((entry) => entry.element === root);
    expect(dark?.keyframes).toEqual([{ filter: 'brightness(0)' }]);
    expect(dark?.cancel).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('only switches on a Mac, which animates full screen itself, and follows its answer', async () => {
    onWindows('darwin');
    const { stage } = player();
    ask.mockResolvedValue(true);
    await switchVisFullScreen(false, stage);
    // Asked to leave a full screen the listener chose: it stays.
    expect(mockClaim.mock.calls).toEqual([[false], [true]]);
    expect(send).not.toHaveBeenCalled();
    expect(covers()).toBe(0);
  });
});
