/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAppBackdropOn } from './backdropVeil';
import { useAmpHoldsWindow } from './sceneTintStore';
import useIsSceneLook from './useIsSceneLook';

/**
 * Whether the full app's window has the Backdrop: a Plus visualizer to draw
 * AND the app's Transparency above 0, which is the Backdrop's switch now that
 * it is no longer a mode (Ivan, 2026-11-16: "instead of having a backdrop
 * mode is just transparency and blur"). A standard look has no picture to
 * stand behind the panes, whatever the slider says. What decides whether the
 * graph's scene is drawn behind the app's window (`GraphScene`).
 */
export const useIsAppBackdrop = () => {
  const isSceneLook = useIsSceneLook();
  const isOn = useAppBackdropOn();
  return isSceneLook && isOn;
};

/**
 * Whether the window wears the Backdrop now: the app's, or the amp's, which
 * is always the Backdrop while a Plus visualizer is on (`setAmpHoldsWindow`).
 *
 * The one answer to "are the panes floating over a picture": the Blur slider
 * stands live by it, and the amp lays its glass out by it (`PlayerAmp`).
 * Asked of what is chosen, never of whether the picture has loaded yet, or
 * the amp would change shape while a scene compiles.
 */
const useIsBackdrop = () => {
  const isSceneLook = useIsSceneLook();
  const isApp = useIsAppBackdrop();
  const isAmp = useAmpHoldsWindow();
  return isAmp ? isSceneLook : isApp;
};

export default useIsBackdrop;
