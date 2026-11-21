/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IWhisperOutput } from './whisperProgress';

/** One column of Whisper's cross-attention grid; every timestamp is a multiple. */
const WHISPER_TIME_PRECISION = 0.02;

/**
 * Words the timestamp head reported a position it does not have.
 *
 * When the DTW backtrack runs out of audio columns it parks every remaining
 * token on the window's last one, so the value is closed form: chunk k starts
 * at k*(chunkLength - 2*strideLength) and its final column sits chunkLength -
 * 0.02 s later. Measured before the library patch, one 253 s song put 27 of
 * 158 words on those columns and one word 13 s past the end of the audio.
 *
 * Counted by the worker because only it knows the chunk geometry — by the time
 * a transcript reaches the project, 169.98 is just a number. Reported rather
 * than repaired: a run that quietly drops a third of its words still reads as
 * a successful detection, which is how this went unnoticed.
 */
const whisperUnplacedWordCount = (
  output: IWhisperOutput,
  chunkLength: number,
  strideLength: number,
  durationSeconds: number,
): { terminal: number; pastEnd: number; stacked: number; at: number[] } => {
  const jump = chunkLength - strideLength * 2;
  const terminalAt = chunkLength - WHISPER_TIME_PRECISION;
  const starts = (output.chunks ?? []).flatMap((word) => {
    const start = word.timestamp?.[0];
    return typeof start === 'number' ? [start] : [];
  });
  const seen = new Map<number, number>();
  starts.forEach((start) => seen.set(start, (seen.get(start) ?? 0) + 1));
  const isTerminal = (start: number): boolean => {
    if (jump <= 0) {
      return false;
    }
    const offset = start - terminalAt;
    return (
      offset >= -WHISPER_TIME_PRECISION &&
      Math.abs(offset - Math.round(offset / jump) * jump) <=
        WHISPER_TIME_PRECISION
    );
  };
  const at = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([start]) => Math.round(start * 100) / 100)
    .sort((left, right) => left - right)
    .slice(0, 12);
  return {
    // Three shapes, because they have different causes and one patch cannot
    // answer for all of them: DTW walking off the end of its window, DTW
    // placing a word past the audio entirely, and DTW piling many tokens onto
    // one frame in the middle of a window.
    terminal: starts.filter(isTerminal).length,
    pastEnd: starts.filter((start) => start >= durationSeconds).length,
    stacked: starts.filter((start) => (seen.get(start) ?? 0) > 1).length,
    at,
  };
};

export default whisperUnplacedWordCount;
