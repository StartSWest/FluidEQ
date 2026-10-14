/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisDeEsser } from '../../common/dsp/analysisWire';

/**
 * What the De-esser cut in the last analysis window, and why.
 *
 * Polled rather than subscribed, like Bass Punch's gains: the page's strip is
 * a scroll that samples on every animation frame, and a React update per
 * window would be a reconcile for numbers that are only ever painted.
 *
 * `undefined` until an engine that has the stage reports it. An engine from
 * before the De-esser sends a frame without it, and the page has to tell that
 * apart from a stage that is running and cutting nothing.
 */
let report: Readonly<IHostAnalysisDeEsser> | undefined;

export const setDspDeEsserReport = (
  next: IHostAnalysisDeEsser | undefined,
): void => {
  report = next;
};

export const readDspDeEsserReport = ():
  Readonly<IHostAnalysisDeEsser> | undefined => report;
