/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { renderHook } from '@testing-library/react';
import openLookPickerPlace from 'renderer/graph/lookPickerPlaces';
import usePlusTabOpensApp from 'renderer/player/usePlusTabOpensApp';

/**
 * The look picker's Explore scenes, pressed in the Compact player: the
 * player does not show the app's tabs, so it has to bring the full app back
 * on the Visualizers tab, not switch the tab behind itself (Ivan, 2026-10-29:
 * "explorar escenes while open amp ui need to go to full app").
 */

jest.mock('renderer/plus/plusNavigation', () => ({
  openGalleryPage: jest.fn(),
  openPlusPlace: jest.fn(),
}));
jest.mock('renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));

const exploreScenes = () => openLookPickerPlace('gallery', jest.fn(), true);

it('opens the full app on the Visualizers tab from the player', () => {
  const openPage = jest.fn();
  renderHook(() => usePlusTabOpensApp(true, openPage));

  exploreScenes();

  expect(openPage).toHaveBeenCalledTimes(1);
  expect(openPage).toHaveBeenCalledWith('plus');
});

it('leaves the full app to switch its own tab', () => {
  const openPage = jest.fn();
  renderHook(() => usePlusTabOpensApp(false, openPage));

  exploreScenes();

  expect(openPage).not.toHaveBeenCalled();
});

it('stops once the window has left the player', () => {
  const openPage = jest.fn();
  const { rerender, unmount } = renderHook(
    ({ isPlayer }) => usePlusTabOpensApp(isPlayer, openPage),
    { initialProps: { isPlayer: true } },
  );

  rerender({ isPlayer: false });
  exploreScenes();
  expect(openPage).not.toHaveBeenCalled();

  rerender({ isPlayer: true });
  unmount();
  exploreScenes();
  expect(openPage).not.toHaveBeenCalled();
});
