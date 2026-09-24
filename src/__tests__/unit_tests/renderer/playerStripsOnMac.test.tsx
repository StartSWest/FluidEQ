/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import FoldStrip from 'renderer/player/FoldStrip';
import PlayerTitleStrip from 'renderer/player/PlayerTitleStrip';

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
jest.mock('renderer/player/usePlayerSource', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/player/usePlayerClock', () => ({
  __esModule: true,
  default: () => ({
    second: undefined,
    durationMs: undefined,
    hasPosition: false,
  }),
}));
jest.mock('renderer/player/libraryDeck', () => ({
  useLibraryDeck: () => undefined,
}));
jest.mock('renderer/utils/useEqualizerPower', () => ({
  __esModule: true,
  default: () => ({
    isEnabled: true,
    isBlockingError: false,
    toggle: jest.fn(() => Promise.resolve()),
  }),
}));

const on = (platform: string) => {
  window.electron = {
    platform,
    ipcRenderer: {
      sendMessage: jest.fn(),
      minimizeWindow: jest.fn(() => Promise.resolve()),
      closeWindow: jest.fn(() => Promise.resolve()),
    },
  } as unknown as typeof window.electron;
};

beforeEach(() => {
  window.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof window.ResizeObserver;
});

describe("the player's strips on each system", () => {
  it("draw Windows' minimise and close, and no place for traffic lights, on Windows", () => {
    on('win32');
    const { container, unmount } = render(
      <PlayerTitleStrip onFold={jest.fn()} onOpenPage={jest.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'Minimize FluidEQ' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close FluidEQ' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.traffic-light-slot')).toBeNull();
    unmount();

    render(<FoldStrip onUnfold={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Minimize FluidEQ' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close FluidEQ' }),
    ).toBeInTheDocument();
  });

  it("leave minimise and close to a Mac's own traffic lights, and keep unfold", () => {
    on('darwin');
    const { container, unmount } = render(
      <PlayerTitleStrip onFold={jest.fn()} onOpenPage={jest.fn()} />,
    );
    expect(
      screen.queryByRole('button', { name: 'Minimize FluidEQ' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close FluidEQ' })).toBeNull();
    expect(container.querySelector('.traffic-light-slot')).not.toBeNull();
    unmount();

    const fold = render(<FoldStrip onUnfold={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Minimize FluidEQ' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close FluidEQ' })).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Unfold' }).length,
    ).toBeGreaterThan(0);
    expect(fold.container.querySelector('.traffic-light-slot')).not.toBeNull();
  });
});
