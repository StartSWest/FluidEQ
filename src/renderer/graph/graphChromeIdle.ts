/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSceneLook } from '../utils/graphStyle';
import { useGraphFullScreen } from '../utils/graphViewSettings';
import { useIsChromeIdle } from '../utils/idleChrome';

/**
 * Whether a Plus visualizer holds the graph's own chrome — the strip of
 * controls across the top of the plot, and the scene's view reset in its
 * corner — on screen, where the window's stillness would fade it
 * (`useIsChromeIdle`; `useIsGraphChromeIdle` below is the two together).
 *
 * In the ordinary view only. There the strip stays, on a shade of the floor
 * that holds it (`.chart-scene-scrim`): faded out after a few still seconds
 * and back at the next touch of the mouse, over a picture that is moving
 * anyway, it read as buttons appearing and disappearing by themselves (Ivan,
 * 2026-09-26: "I can see them and not see them"). Full screen is watched
 * rather than worked on, and keeps the fade and no shade.
 *
 * The one place this is decided: the strip, the reset and the shade all read
 * it, and two of them deciding separately is how one would fade without the
 * others.
 */
export const useIsGraphChromeHeld = () => {
  const isFullScreen = useGraphFullScreen();
  const scene = useSceneLook();
  return Boolean(scene) && !isFullScreen;
};

export const useIsGraphChromeIdle = () => {
  const isChromeIdle = useIsChromeIdle();
  const isHeld = useIsGraphChromeHeld();
  return isChromeIdle && !isHeld;
};
