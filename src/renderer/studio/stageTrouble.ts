/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStageTrouble } from './StudioStage';

/**
 * Whether what the stage reported holds the version back from being published
 * and kept. A shader that did not compile, a scene too heavy to draw or a 3D
 * world that did not draw at all does; a world that drew with a part left out
 * does not — it plays as its author sees it, with the reason beside it, and
 * held back it said "the world was not drawn" over a world on the stage.
 */
const troubleHoldsBack = (trouble: TStageTrouble | undefined): boolean =>
  trouble !== undefined && !(trouble.kind === 'world' && trouble.report.drawn);

export default troubleHoldsBack;
