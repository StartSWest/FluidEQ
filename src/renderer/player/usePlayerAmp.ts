/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TPlayerAmp } from 'common/windowMode';
import useIsBackdrop from '../utils/useIsBackdrop';

/**
 * Which amp the player is: the glass Stage while the window wears the
 * Backdrop, the 2.0 amp in every other mode. Asked of what is chosen, so the
 * full app knows it too, and the switch opens the player at that amp's own
 * size (`reportPlayerAmp`).
 */
const usePlayerAmp = (): TPlayerAmp => (useIsBackdrop() ? 'stage' : 'classic');

export default usePlayerAmp;
