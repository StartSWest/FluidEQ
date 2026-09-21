/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether moving a band on the EQ pages changes anything you can hear.
 *
 * Three ways it cannot, and the pages dim and lock on all three:
 *
 *  - FluidEQ is switched off;
 *  - nothing is installed behind the sliders (a blocking error);
 *  - the engine is chosen and on, and not reaching the output being listened
 *    to.
 *
 * `isEngineUsable` in the context answers the first two and cannot see the
 * third — that fact lives with the engine's own status, not in the context —
 * so the EQ page went on presenting the rack as live over an engine that was
 * not processing anything: every slider draggable, every change landing
 * nowhere, while the side bar's switch read off and the engine's name wore
 * its red dot beside it. The context's own comment warns about exactly this:
 * a place that forgets half the condition and leaves a pane live over an
 * engine that is not there.
 *
 * Undefined is not a fault. The window often cannot tell yet — no status
 * read, or an engine that reports none — and the rack stays usable until it
 * can say otherwise, which is the rule the side bar's switch follows too.
 */
const eqReachesSound = (
  isEngineUsable: boolean,
  isEngineOnOutput: boolean | undefined,
): boolean => isEngineUsable && isEngineOnOutput !== false;

export default eqReachesSound;
