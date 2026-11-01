/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { subscribePlusTabRequests } from '../plus/plusTabRequest';
import type { TPlayerPage } from './PlayerMarkMenu';

/**
 * While the window is the Compact player, a request to see the Visualizers
 * tab opens the full app on it, the way the player's own menu opens a page.
 *
 * The player does not show the app's tabs, so the request alone only
 * switched the tab behind it: the look picker's Explore scenes appeared to do
 * nothing (Ivan, 2026-10-29: "explorar escenes while open amp ui need to go
 * to full app").
 */
const usePlusTabOpensApp = (
  isPlayer: boolean,
  openPage: (page: TPlayerPage) => void,
): void => {
  useEffect(
    () =>
      isPlayer ? subscribePlusTabRequests(() => openPage('plus')) : undefined,
    [isPlayer, openPage],
  );
};

export default usePlusTabOpensApp;
