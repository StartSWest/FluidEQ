/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAmpHoldsWindow } from './sceneTintStore';
import useIsSceneLook from './useIsSceneLook';

/**
 * Whether the window wears the Backdrop now: the amp's, which is always the
 * Backdrop while a Plus visualizer is on (`setAmpHoldsWindow`). The full
 * app's was taken out (Ivan, 2026-11-16: "I didn't like the scene backdrop
 * experiment so remove that").
 *
 * The one answer to "are the panes floating over a picture": the window
 * follows the scene's colours by it (`SceneTint`), and the amp lays its
 * glass out by it (`PlayerAmp`).
 * Asked of what is chosen, never of whether the picture has loaded yet, or
 * the amp would change shape while a scene compiles.
 */
const useIsBackdrop = () => {
  const isSceneLook = useIsSceneLook();
  const isAmp = useAmpHoldsWindow();
  return isAmp && isSceneLook;
};

export default useIsBackdrop;
