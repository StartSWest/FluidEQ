/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { readDspChannelPeaks } from '../dsp/store';

/**
 * The app's SECOND source of clipping, and the reason it exists.
 *
 * The capture says a channel clipped when the samples it hears are at a
 * digital rail. That is the truth about what left the machine — but it is
 * late: FluidEQ's own engine sees each channel BEFORE Windows gets a chance
 * to limit it, and the loopback keeps about a decibel of headroom, so a chain
 * that overshoots is squashed on the way out and never reaches the capture as
 * clipping at all. It only sounds wrong. The meter has always folded that in;
 * the titlebar wave and the graph's warning did not, so the three disagreed
 * about the same moment and only one of them ever went red.
 *
 * Here so all three read one value. Held for the same window the capture holds
 * its own verdict for: a 45ms clipped frame is gone before the eye registers
 * it, and a warning nobody can see is not a warning.
 */
const CLIP_HOLD_MS = 420;

/**
 * The ceiling this warns about, and it is NOT full scale.
 *
 * Windows' loopback holds its own headroom of about a decibel: a chain that
 * reaches 0 dBFS in FluidEQ is limited on the way out, so by the time samples
 * rail in the capture the damage has already been done and been tidied over.
 * Warning at the loopback's ceiling instead means the warning arrives while
 * there is still something to do about it — pull the preamp, drop a band —
 * rather than after the system has quietly squashed the peak.
 *
 * -1 dBFS as an amplitude: 10 ** (-1 / 20).
 */
const INTERNAL_CEILING = 0.891;

let clipUntilMs = 0;
const listeners = new Set<() => void>();

/**
 * Whether the engine railed recently. Read on demand rather than published on
 * a timer: the peaks are already being read every frame by whatever is drawing
 * a meter, and a store that woke the app up to say "still not clipping" would
 * cost more than the fact is worth.
 */
export const readInternalClipping = (nowMs: number): boolean => {
  const peaks = readDspChannelPeaks();
  const railed = peaks.some((peak) => peak >= INTERNAL_CEILING);
  if (railed) {
    const next = nowMs + CLIP_HOLD_MS;
    if (next > clipUntilMs) {
      clipUntilMs = next;
      listeners.forEach((listener) => listener());
    }
  }
  return nowMs < clipUntilMs;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * For the two surfaces that only draw when something changes — the titlebar
 * wave and the graph's warning badge. The meter calls `readInternalClipping`
 * directly, because it is already inside a frame loop with the current time
 * in hand.
 */
export const useInternalClipping = () =>
  useSyncExternalStore(
    subscribe,
    () => performance.now() < clipUntilMs,
    () => false,
  );

export default useInternalClipping;
