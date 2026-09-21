/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the three tone dials are set to, kept rather than worked out again.
 *
 * They used to be read back out of the curve every time the controls
 * appeared, by fitting the three shapes to it — and that is lossy in both
 * directions. The rack cannot make an ideal shelf, and the fit that writes
 * one is deliberately local and smooth, so what comes back describes the
 * curve only approximately: Treble set to 8 read as 7.2 with -0.8 of Bass and
 * -1.5 of Mid beside it, and Bass -6 with Mid +3 read as -8.2 / +3.5 / -2.6.
 * Leaving the page and returning moved every dial, and so did changing the
 * band count.
 *
 * So the values are what is kept, and they survive both: the dials read what
 * they were set to, on any rack, and what gets rebuilt underneath them is
 * only the curve they are measured against. The curve is read for them once,
 * when there is nothing here yet — a first run, or storage cleared.
 *
 * Per machine rather than in the rack, like the DSP page's open section: this
 * is how the tuning is being looked at and not part of it, so it must never
 * travel in an exported preset or come back with an imported one.
 */
import { IToneStack, TONE_MAX_DB } from '../../common/toneStack';

export const TONE_MEMORY_KEY = 'fluideq.eq.tone';

/** A dial value that came from storage, which is to say from anywhere. */
const readDial = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(-TONE_MAX_DB, Math.min(TONE_MAX_DB, value));
};

/**
 * The values the dials were left at, or nothing the first time.
 *
 * Nothing is also the answer when storage cannot be read or holds something
 * this app did not write: the controls then read the curve, which is where
 * they started.
 */
export const recallTone = (): IToneStack | undefined => {
  try {
    const text = window.localStorage.getItem(TONE_MEMORY_KEY);
    if (text === null) {
      return undefined;
    }
    const held: unknown = JSON.parse(text);
    if (typeof held !== 'object' || held === null) {
      return undefined;
    }
    const { bass, mid, treble } = held as Record<string, unknown>;
    const read = [readDial(bass), readDial(mid), readDial(treble)];
    if (read.some((value) => value === undefined)) {
      return undefined;
    }
    const [one, two, three] = read as number[];
    return { bass: one, mid: two, treble: three };
  } catch {
    return undefined;
  }
};

export const rememberTone = (tone: IToneStack): void => {
  try {
    window.localStorage.setItem(TONE_MEMORY_KEY, JSON.stringify(tone));
  } catch {
    // Nothing to do and nothing to say: the controls still work, they only
    // forget, which is where they started.
  }
};
