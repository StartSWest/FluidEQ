/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { IHostAnalysis } from '../../common/dsp/analysisWire';
import { decodeAnalysis } from './wire';

const decodeExtended = (
  payload: Buffer,
  bytes: 8 | 16,
): IHostAnalysis | undefined => {
  if (payload.length < bytes) {
    return undefined;
  }
  const offset = payload.length - bytes;
  const frame = decodeAnalysis(payload.subarray(0, offset));
  if (!frame) {
    return undefined;
  }
  const inputTruePeakDb = payload.readFloatLE(offset);
  const inputLufs = payload.readFloatLE(offset + 4);
  const referenceLufs =
    bytes === 16 ? payload.readFloatLE(offset + 8) : undefined;
  const levelState =
    bytes === 16 ? payload.readFloatLE(offset + 12) : undefined;
  if (
    !Number.isFinite(inputTruePeakDb) ||
    !Number.isFinite(inputLufs) ||
    (referenceLufs !== undefined && !Number.isFinite(referenceLufs)) ||
    (levelState !== undefined &&
      (!Number.isInteger(levelState) || levelState < 0 || levelState > 5))
  ) {
    return undefined;
  }
  return {
    ...frame,
    normalizer: {
      ...frame.normalizer,
      inputTruePeakDb,
      inputLufs,
      referenceLufs,
      levelState,
    },
  };
};
/** Exact lengths keep malformed records from masquerading as legacy frames. */
const decodeEngineAnalysis = (payload: Buffer): IHostAnalysis | undefined =>
  decodeAnalysis(payload) ??
  decodeExtended(payload, 16) ??
  decodeExtended(payload, 8);
export default decodeEngineAnalysis;
