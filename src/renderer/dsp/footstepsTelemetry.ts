/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisFootsteps } from '../../common/dsp/analysisWire';

/**
 * What Footsteps heard, lifted and calmed in the last analysis window.
 *
 * Polled rather than subscribed, like the De-esser's: the page's strip
 * samples it on every animation frame, and a React update per window would
 * be a reconcile for numbers that are only ever painted.
 *
 * `undefined` until an engine that has the stage reports it, so the page can
 * tell an engine from before Footsteps from a stage lifting nothing.
 */
let report: Readonly<IHostAnalysisFootsteps> | undefined;

export const setDspFootstepsReport = (
  next: IHostAnalysisFootsteps | undefined,
): void => {
  report = next;
};

export const readDspFootstepsReport = ():
  Readonly<IHostAnalysisFootsteps> | undefined => report;
