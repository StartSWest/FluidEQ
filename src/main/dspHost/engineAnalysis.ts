/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import {
  ANALYSIS_DEESSER_HEADER_BYTES,
  ANALYSIS_DYNAMICS_HEADER_BYTES,
  ANALYSIS_FOOTSTEPS_HEADER_BYTES,
  ANALYSIS_GAME_HEADER_BYTES,
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_LEGACY_HEADER_BYTES,
  ANALYSIS_VOICE_HEADER_BYTES,
  IHostAnalysis,
} from '../../common/dsp/analysisWire';
import { decodeAnalysis } from './wire';

const decodeExtended = (
  payload: Buffer,
  bytes: 8 | 16 | 20,
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
    bytes >= 16 ? payload.readFloatLE(offset + 8) : undefined;
  const levelState = bytes >= 16 ? payload.readFloatLE(offset + 12) : undefined;
  const outputLufs =
    bytes === 20 ? payload.readFloatLE(offset + 16) : undefined;
  if (
    !Number.isFinite(inputTruePeakDb) ||
    !Number.isFinite(inputLufs) ||
    (referenceLufs !== undefined && !Number.isFinite(referenceLufs)) ||
    (outputLufs !== undefined && !Number.isFinite(outputLufs)) ||
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
      outputLufs,
      referenceLufs,
      levelState,
    },
  };
};

/** A record at one header length, with optional live Normalizer readings. */
const decodeAt = (
  payload: Buffer,
  headerBytes: number,
): IHostAnalysis | undefined =>
  decodeAnalysis(payload, headerBytes) ??
  decodeExtended(payload, 20, headerBytes) ??
  decodeExtended(payload, 16, headerBytes) ??
  decodeExtended(payload, 8, headerBytes);

/**
 * Exact lengths keep malformed records from masquerading as legacy frames.
 *
 * The engine is installed apart from the app and may be one from before
 * Voice level (a header of 896 bytes), before a mic's readings (872),
 * before Dynamics' (840), before the rest of the Game filter (816), before
 * Footsteps (784) or before the De-esser (560): its record is read at the
 * length that fits, its whole length following from its header and its
 * tail of 8, 16 or 20 bytes. Headers 24 bytes or more apart cannot be
 * confused through tails 12 apart at most. 904 and 896 are 8 apart, which
 * an 8-byte tail after 904 against a 16-byte one after 896 would make up;
 * no engine writes either, because every engine with those headers (1.32
 * and later) writes the 20-byte tail. Older engines have no output LUFS
 * reading; leave it absent rather than guessing it from the current gain.
 */
const decodeEngineAnalysis = (payload: Buffer): IHostAnalysis | undefined =>
  decodeAt(payload, ANALYSIS_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_VOICE_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_DYNAMICS_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_GAME_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_FOOTSTEPS_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_DEESSER_HEADER_BYTES) ??
  decodeAt(payload, ANALYSIS_LEGACY_HEADER_BYTES);
export default decodeEngineAnalysis;
