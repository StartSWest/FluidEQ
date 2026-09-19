/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisRoom } from '../../common/dsp/analysisWire';

let report: Readonly<IHostAnalysisRoom> | undefined;
const listeners = new Set<() => void>();
export const readDspRoomReport = (): Readonly<IHostAnalysisRoom> | undefined =>
  report;
export const subscribeDspRoomReport = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
/** Independent from the rack settings store: only report consumers subscribe. */
export const setDspRoomReport = (next: IHostAnalysisRoom | undefined): void => {
  if (JSON.stringify(report) === JSON.stringify(next)) {
    return;
  }
  report = next ? Object.freeze({ ...next }) : undefined;
  listeners.forEach((listener) => listener());
};
