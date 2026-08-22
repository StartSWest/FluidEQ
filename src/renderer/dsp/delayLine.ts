/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A plain delay, for the channel that is NOT being filtered.
 *
 * Linear phase costs latency, and latency only stays inaudible while every
 * channel pays it. Mid/side breaks that: the mode filters the middle or the
 * sides and passes the other through untouched, so with the convolver running
 * one of them arrived 8704 samples — 181 ms — ahead of the other. Recombining
 * a mid and a side that far apart is not a subtle colouration, it is the stereo
 * image coming apart, which is exactly how it was reported.
 *
 * Nothing here filters. It exists so the untouched path can be exactly as late
 * as the filtered one.
 */
export interface IDelayLineState {
  readonly buffer: Float32Array;
  cursor: number;
  /** How many samples back the read head sits. Fixed for the line's life. */
  readonly delay: number;
}

export const createDelayLine = (delay: number): IDelayLineState => ({
  // N+1 slots for N samples of delay: the N being held, plus the one arriving.
  // At exactly N the read and the write land on the same slot, which is the
  // correct answer for a delay of zero and never reached above it.
  buffer: new Float32Array(Math.max(1, delay) + 1),
  cursor: 0,
  delay: Math.max(0, delay),
});

/** Delay `buffer` in place by the line's own length. */
export const processDelayLine = (
  state: IDelayLineState,
  buffer: Float32Array,
): void => {
  const { length } = state.buffer;
  for (let i = 0; i < buffer.length; i += 1) {
    const read = (state.cursor + length - state.delay) % length;
    state.buffer[state.cursor] = buffer[i];
    buffer[i] = state.buffer[read];
    state.cursor = (state.cursor + 1) % length;
  }
};
