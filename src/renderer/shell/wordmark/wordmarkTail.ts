/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE Q'S TAIL IS THE MUSIC (Ivan picked the "Signature" direction,
 * 2026-11-26: the stroke that finishes the Q runs on as the sound itself).
 *
 * What it draws is the capture's own waveform — the block the header's meter
 * already receives — taken down to a few dozen points and smoothed, so the
 * tail sways with the bass and ripples with what is above it rather than
 * scribbling every sample. It leaves the letter with no movement at all at
 * the join (the word itself never wobbles) and fades out at its far end. A
 * still flourish underlies it, so silence, a pause and reduced motion all
 * leave the same calm curve rather than a straight line.
 *
 * Everything here is arithmetic on numbers, so it is tested apart from the
 * drawing (`headerWordmarkTail.test.ts`).
 */

/** Points along the tail. Enough for a smooth curve at any width it reaches. */
export const TAIL_POINTS = 56;

/** Furthest the music moves the tail from its still curve, px, either way. */
export const TAIL_SWAY_PX = 6;

/** The still flourish's height at its peak, px. */
const STILL_PX = 1.4;

/**
 * Loudness that moves the tail its whole sway. A capture's samples run
 * -1..1; ordinary loud music averages a quarter of that over the windows
 * taken here, so this reads it as full and leaves room above.
 */
const FULL_SCALE = 0.32;

/** Five-tap smoothing across neighbouring points, so a hat does not scribble. */
const SMOOTHING = [1, 2, 3, 2, 1] as const;
const SMOOTHING_SUM = SMOOTHING.reduce((total, weight) => total + weight, 0);

/**
 * The waveform as the tail carries it: `count` points, each the mean of its
 * share of the samples, smoothed with its neighbours and softly limited to
 * -1..1 so a loud block bends the tail without breaking it. Silence and an
 * empty block are all zeros.
 */
export const tailSignal = (
  waveform: readonly number[],
  count: number = TAIL_POINTS,
): number[] => {
  const means = new Array<number>(count).fill(0);
  if (waveform.length === 0) {
    return means;
  }
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor((i * waveform.length) / count);
    const to = Math.max(
      from + 1,
      Math.floor(((i + 1) * waveform.length) / count),
    );
    let sum = 0;
    for (let s = from; s < to; s += 1) {
      sum += waveform[s] ?? 0;
    }
    means[i] = sum / (to - from);
  }
  return means.map((_, i) => {
    let sum = 0;
    SMOOTHING.forEach((weight, k) => {
      const at = Math.min(count - 1, Math.max(0, i + k - 2));
      sum += means[at] * weight;
    });
    return Math.tanh(sum / SMOOTHING_SUM / FULL_SCALE);
  });
};

/** Points of the music a tail keeps, by its length: what reads as a sway. */
export const tailAnchors = (lengthPx: number): number =>
  lengthPx < 60 ? 4 : 12;

/**
 * The signal as a smooth sway through `anchors` of its points, one at the
 * middle of each equal share, joined by eased curves. Seen at its own size,
 * every point of a block of music is a scribble, worst on the short flourish
 * the tail has at 1920 (22px carrying 56 points read as noise in the
 * window); kept to a few, it moves with the music the way a pen line would.
 * The anchors are taken, not averaged: a block holds two or three swings of
 * the bass, and their mean is nothing.
 */
export const calmSignal = (
  signal: readonly number[],
  anchors: number,
): number[] => {
  const count = signal.length;
  if (anchors >= count || anchors < 2) {
    return [...signal];
  }
  const kept = Array.from(
    { length: anchors },
    (_, a) =>
      signal[Math.min(count - 1, Math.floor(((a + 0.5) * count) / anchors))],
  );
  return signal.map((_, i) => {
    const at = ((i + 0.5) / count) * anchors - 0.5;
    const low = Math.max(0, Math.min(anchors - 1, Math.floor(at)));
    const high = Math.min(anchors - 1, low + 1);
    const t = Math.min(1, Math.max(0, at - low));
    const eased = (1 - Math.cos(t * Math.PI)) / 2;
    return kept[low] * (1 - eased) + kept[high] * eased;
  });
};

/**
 * How much of the music the tail carries at `u` (0 at the Q, 1 at the end):
 * none at the join, all of it a quarter of the way along, fading to none.
 */
export const tailEnvelope = (u: number): number => {
  const clamped = Math.min(1, Math.max(0, u));
  return (
    Math.sin((Math.min(1, clamped * 4) * Math.PI) / 2) * (1 - clamped) ** 0.7
  );
};

/** The still flourish at `u`, px: a shallow arc that settles into the end. */
export const tailRest = (u: number): number => {
  const clamped = Math.min(1, Math.max(0, u));
  return Math.sin(clamped * Math.PI * 1.2) * STILL_PX * (1 - clamped);
};

/**
 * Where each point of the tail sits, px below its line (negative is above):
 * the still flourish plus the music, shaped by the envelope. `sway` is how far
 * the music may move it.
 */
export const tailOffsets = (
  signal: readonly number[],
  sway: number = TAIL_SWAY_PX,
): number[] => {
  const last = Math.max(1, signal.length - 1);
  return signal.map((value, i) => {
    const u = i / last;
    return tailRest(u) + tailEnvelope(u) * sway * value;
  });
};

/**
 * The tail's width at `u` (0 at the Q, 1 at its end), as a share of the pen's
 * width at the Q: thinning to a fine line as it becomes sound, then running
 * out to a point, as a broad pen's stroke ends when it lifts off.
 *
 * It used to stop at a fine line 1.5px wide, a square end that read as the
 * tail sliced off in the window (Ivan, 2026-11-26: "its tail, it slices");
 * the last fifth now closes to nothing.
 */
export const tailWidthShare = (u: number, startWidth: number): number => {
  const clamped = Math.min(1, Math.max(0, u));
  const fine = Math.min(1, 1.2 / Math.max(startWidth, 1.2));
  const thinned = 1 + (fine - 1) * Math.min(1, (clamped * 1.6) ** 0.8);
  const lift =
    clamped < 0.8 ? 1 : Math.cos(((clamped - 0.8) / 0.2) * (Math.PI / 2));
  return thinned * lift;
};

/**
 * The tail as a filled outline, tapering from `startWidth` at the Q to a
 * point at its end (`tailWidthShare`). `offsets` are px below the line at
 * `y`, spread evenly over `length` px.
 */
export const tailOutline = (
  offsets: readonly number[],
  length: number,
  y: number,
  startWidth: number,
): string => {
  const last = Math.max(1, offsets.length - 1);
  const top: string[] = [];
  const bottom: string[] = [];
  offsets.forEach((offset, i) => {
    const u = i / last;
    const half = (startWidth * tailWidthShare(u, startWidth)) / 2;
    const x = (u * length).toFixed(1);
    top.push(`${x} ${(y + offset - half).toFixed(2)}`);
    bottom.push(`${x} ${(y + offset + half).toFixed(2)}`);
  });
  return `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
};
