/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useIsChromeIdle } from '../utils/idleChrome';

/**
 * Whether the graph's own chrome has faded for the window's stillness
 * (`useIsChromeIdle`): the strip of controls across the top of the plot with
 * the shade it carries (`.live-output-controls::before`).
 *
 * A Plus visualizer used to hold all of it on screen in the ordinary view
 * (2026-09-26: "I can see them and not see them"). With a shade under the
 * strip, that hold laid a dark band over the top of every scene for good,
 * and Ivan asked for the picture whole whenever the options are away
 * (2026-09-27: "the top drop shadow only appears when graph options is shown
 * and disappears when hidden, so we see full plus viz to the top"). So a
 * scene's chrome fades like every other look's, and comes back at the next
 * touch of the mouse.
 *
 * The one place this is decided: the strip and its shade read it, and the
 * two deciding separately is how one would fade without the other. A
 * scene's Reset view is not among them: it shows only while the camera's key
 * is held over the scene (`SceneViewReset`).
 */
const useIsGraphChromeIdle = () => useIsChromeIdle();

export default useIsGraphChromeIdle;
