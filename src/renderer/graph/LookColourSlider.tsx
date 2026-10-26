/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useIsSceneLook from '../utils/useIsSceneLook';
import BackdropVeilSlider from './BackdropVeilSlider';
import WindowTintSlider from './WindowTintSlider';

/**
 * The row beside Brightness: Transparency while a Plus visualizer is chosen,
 * which is what puts a picture behind the panes, and the window's Tint with a
 * standard look, which has no picture to see through and no colours of its
 * own to lend (Ivan, 2026-10-25: "instead of showing transparency disabled
 * we show the tint"). In the full app's window-colours menu and the amp's.
 */
const LookColourSlider = () =>
  useIsSceneLook() ? <BackdropVeilSlider /> : <WindowTintSlider />;

export default LookColourSlider;
