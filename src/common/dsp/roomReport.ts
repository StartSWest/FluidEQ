/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisRoom } from './analysisWire';
/** Reserved analysis words: old writers leave zero; unknown tags stay absent. */
const decodeRoomReport = (
  flags: number,
  referenceGainDb: number,
): IHostAnalysisRoom | undefined => {
  if (
    !Number.isInteger(flags) ||
    flags < 0x524d0100 ||
    flags > 0x524d013f ||
    !Number.isFinite(referenceGainDb) ||
    Math.abs(referenceGainDb) > 6
  ) {
    return undefined;
  }
  const active = Math.floor(flags / 1) % 2 !== 0;
  const sourceBypassed = Math.floor(flags / 32) % 2 !== 0;
  if (
    (!active && Math.floor(flags / 2) % 16 !== 0) ||
    (active && sourceBypassed)
  ) {
    return undefined;
  }
  return {
    active,
    original: Math.floor(flags / 2) % 2 !== 0,
    matchAvailable: Math.floor(flags / 4) % 2 !== 0,
    referenceGainDb,
    conventionalFoldDown: Math.floor(flags / 8) % 2 !== 0,
    positionProtected: Math.floor(flags / 16) % 2 !== 0,
    sourceBypassed,
  };
};

export default decodeRoomReport;
