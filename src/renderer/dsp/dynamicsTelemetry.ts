/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisDynamics } from '../../common/dsp/analysisWire';

/** Polled by the canvas; no React reconciliation for each audio block. */
let report: Readonly<IHostAnalysisDynamics> | undefined;

export const setDspDynamicsReport = (
  next: IHostAnalysisDynamics | undefined,
) => {
  report = next;
};

export const readDspDynamicsReport = () => report;
