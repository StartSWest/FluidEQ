/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp's header wears the main window's name (Ivan, 2026-11-27: "let's
 * show the FluidEQ new nice title handwritten in the amp app too"): the broad
 * pen's drawing where the spaced capitals were, its Q's tail listening to the
 * live sound, and a pen as wide as the word it is laid in.
 */

import '@testing-library/jest-dom';
import { render, within } from '@testing-library/react';
import PlayerTitleStrip from 'renderer/player/PlayerTitleStrip';
import PlayerWordmark, {
  PLAYER_WORDMARK_PX,
  PlayerWordmarkStill,
} from 'renderer/player/PlayerWordmark';
import HeaderWordmark from 'renderer/shell/wordmark/HeaderWordmark';
import { WORDMARK_SHAPE } from 'renderer/shell/wordmark/WordmarkLetters';

const mockListeners: unknown[] = [];
jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrameListener: (listener: unknown) => {
    mockListeners.push(listener);
  },
}));
jest.mock('renderer/player/PlayerMarkMenu', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/player/WindowModeSwitch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/player/windowModeStore', () => ({
  setWindowPinned: jest.fn(() => Promise.resolve()),
  useWindowMode: () => ({ mode: 'player', isPinned: false }),
}));

const { box, tailWidth } = WORDMARK_SHAPE;

/** The pen's width where the tail leaves the Q, read from its outline. */
const tailStartWidth = (container: HTMLElement): number => {
  const d =
    container.querySelector('.header-wordmark__tail path')?.getAttribute('d') ??
    '';
  // The outline opens on the upper edge at the Q, 12px down its box.
  const [, top] = /^M0\.0 ([\d.]+)/.exec(d) ?? [];
  return (12 - Number(top)) * 2;
};

/** Lays the word out `height` px tall, as a bar's stylesheet would. */
const drawWordAt = (height: number) =>
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rect(this: HTMLElement) {
      const isWord =
        this.classList.contains('player-title__wordmark') ||
        this.classList.contains('header-wordmark__word');
      return { height: isWord ? height : 0 } as DOMRect;
    });

beforeEach(() => {
  mockListeners.length = 0;
  window.electron = {
    platform: 'win32',
    ipcRenderer: {
      sendMessage: jest.fn(),
      minimizeWindow: jest.fn(() => Promise.resolve()),
      closeWindow: jest.fn(() => Promise.resolve()),
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("the amp's name", () => {
  it('is the broad pen where the spaced capitals were, beside the mark, with one rule after it', () => {
    const { container } = render(
      <PlayerTitleStrip onFold={jest.fn()} onOpenPage={jest.fn()} />,
    );
    const handle = container.querySelector('.player-title__handle');
    const parts = [...(handle?.children ?? [])].map((part) => part.className);
    expect(parts).toEqual(['player-title__wordmark', 'player-title__line']);
    // No letters as text: the old name was "FluidEQ" set in capitals.
    expect(handle?.textContent).toBe('');
    expect(container.querySelector('.player-title__name')).toBeNull();
  });

  it("draws the main window's word, letter for letter", () => {
    const amp = render(<PlayerWordmark />);
    const main = render(<HeaderWordmark />);
    const word = (root: HTMLElement) =>
      root.querySelector('.wordmark-letters path')?.getAttribute('d');
    expect(
      within(amp.container).getByRole('img', { name: 'FluidEQ' }),
    ).toBeInTheDocument();
    expect(word(amp.container)).toBeTruthy();
    expect(word(amp.container)).toBe(word(main.container));
  });

  it('carries no version and no text: the main window it switches to does', () => {
    const { container } = render(<PlayerWordmark />);
    expect(container.querySelector('.header-wordmark__version')).toBeNull();
    expect(container.textContent).toBe('');
    // The control: the word and its tail are both there to be found.
    expect(container.querySelector('.wordmark-letters')).not.toBeNull();
    expect(container.querySelector('.header-wordmark__tail')).not.toBeNull();
  });

  it('listens to the live sound for its tail, and rests with nothing playing', () => {
    const { container } = render(<PlayerWordmark />);
    expect(mockListeners.length).toBeGreaterThan(0);
    expect(
      container.querySelector('.header-wordmark__tail path')?.getAttribute('d'),
    ).toMatch(/^M0\.0 /);
  });

  it('as a picture, hears nothing at all', () => {
    render(<PlayerWordmarkStill />);
    expect(mockListeners).toHaveLength(0);
  });
});

describe("the tail's pen", () => {
  // The tail reads the word's size from the box it is laid in. Handed a ref
  // to that box instead, it would measure before the ref was attached and
  // start at its thinnest, 1.5px, whatever the word's size.
  it('is as wide as the word it leaves, in the amp and in the main window', () => {
    drawWordAt(PLAYER_WORDMARK_PX);
    const amp = render(<PlayerWordmark />);
    expect(tailStartWidth(amp.container)).toBeCloseTo(
      (tailWidth * PLAYER_WORDMARK_PX) / box.height,
      1,
    );
    jest.restoreAllMocks();

    drawWordAt(36);
    const main = render(<HeaderWordmark />);
    expect(tailStartWidth(main.container)).toBeCloseTo(
      (tailWidth * 36) / box.height,
      1,
    );
    // The control: the two words differ in size, and so do their pens.
    expect(tailStartWidth(main.container)).toBeGreaterThan(
      tailStartWidth(amp.container) + 0.5,
    );
  });

  it("at rest is the same in the amp's picture as in the amp", () => {
    drawWordAt(PLAYER_WORDMARK_PX);
    const live = render(<PlayerWordmark />);
    const still = render(<PlayerWordmarkStill />);
    const tail = (root: HTMLElement) =>
      root.querySelector('.header-wordmark__tail path')?.getAttribute('d');
    expect(tail(still.container)).toBe(tail(live.container));
  });
});
