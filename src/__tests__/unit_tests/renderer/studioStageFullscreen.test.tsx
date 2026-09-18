/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The way out of a full screen stage has to be there whenever the screen is
 * full.
 *
 * It was drawn from the Studio's own idea of the size, and the two can part:
 * leaving fullscreen is a promise the browser can refuse — mid-transition, or
 * because the window manager says so — and the refusal was swallowed, so the
 * screen stayed full with the size back to windowed and the button gone.
 * Ivan: "exit button can't click it sometimes". Escape was all that was left.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IScenePack } from '../../../common/scenePacks';
import StudioStage from '../../../renderer/studio/StudioStage';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const pack = { names: { en: 'Alpine' } } as IScenePack;

/** The element the browser reports as full, and the calls made to leave it. */
let full: Element | null = null;
const exitFullscreen = jest.fn(() => {
  full = null;
  document.dispatchEvent(new Event('fullscreenchange'));
  return Promise.resolve();
});

const stage = (size: 'graph' | 'full', onExitFullscreen: jest.Mock) =>
  render(
    <StudioStage
      identity="one"
      pack={pack}
      serial={1}
      signal="live"
      size={size}
      wave={{ height: 1, position: 0 }}
      isGridShown={false}
      readingRef={{ current: null }}
      onTrouble={jest.fn()}
      onDrawn={jest.fn()}
      onExitFullscreen={onExitFullscreen}
      onToggleFullscreen={jest.fn()}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  full = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => full,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    value(this: Element) {
      full = this;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    },
  });
});

it('offers the way out while the screen is full, whatever the size says', () => {
  const onExit = jest.fn();
  const { rerender } = stage('full', onExit);
  expect(
    screen.getByRole('button', { name: 'studio.size.exit' }),
  ).toBeInTheDocument();

  // The size goes back on its own — a refused exit, another card, anything —
  // while the browser is still showing the stage full.
  rerender(
    <StudioStage
      identity="one"
      pack={pack}
      serial={1}
      signal="live"
      size="graph"
      wave={{ height: 1, position: 0 }}
      isGridShown={false}
      readingRef={{ current: null }}
      onTrouble={jest.fn()}
      onDrawn={jest.fn()}
      onExitFullscreen={onExit}
      onToggleFullscreen={jest.fn()}
    />,
  );
  // Asked to leave, and — until the browser says it has — still offering the
  // way out rather than leaving the member with nothing to press.
  expect(exitFullscreen).toHaveBeenCalled();
});

it('leaves the screen itself, not only the size', async () => {
  const onExit = jest.fn();
  stage('full', onExit);
  await act(async () => Promise.resolve());
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.size.exit' }),
  );
  expect(onExit).toHaveBeenCalled();
  expect(exitFullscreen).toHaveBeenCalled();
});

it('puts the size back when the browser leaves fullscreen by itself', async () => {
  const onExit = jest.fn();
  stage('full', onExit);
  await act(async () => Promise.resolve());
  // Escape, or the window manager.
  await act(async () => {
    full = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  expect(onExit).toHaveBeenCalled();
});
