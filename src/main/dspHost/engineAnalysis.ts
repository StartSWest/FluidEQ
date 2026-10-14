/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import {
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_LEGACY_HEADER_BYTES,
  IHostAnalysis,
} from '../../common/dsp/analysisWire';
import { decodeAnalysis } from './wire';

const decodeExtended = (
  payload: Buffer,
  bytes: 8 | 16,
  headerBytes: number,
): IHostAnalysis | undefined => {
  if (payload.length < bytes) {
    return undefined;
  }
  const offset = payload.length - bytes;
  const frame = decodeAnalysis(payload.subarray(0, offset), headerBytes);
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

/** A record at one header length: plain, or with either extension. */
const decodeAt = (
  payload: Buffer,
  headerBytes: number,
): IHostAnalysis | undefined =>
  decodeAnalysis(payload, headerBytes) ??
  decodeExtended(payload, 16, headerBytes) ??
  decodeExtended(payload, 8, headerBytes);

/**
 * Exact lengths keep malformed records from masquerading as legacy frames.
 *
 * The engine is installed apart from the app and may be one from before the
 * De-esser, whose header is 224 bytes shorter: its record is read at that
 * length when this build's does not fit. The two cannot be mistaken for each
 * other, because a record's whole length follows from its header and the
 * extensions are 8 or 16 bytes, never 224.
 */
const decodeEngineAnalysis = (payload: Buffer): IHostAnalysis | undefined =>
  decodeAt(payload, ANALYSIS_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_LEGACY_HEADER_BYTES);
export default decodeEngineAnalysis;
