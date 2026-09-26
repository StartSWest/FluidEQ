/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IChartPointData } from './graph/ChartController';
import { NO_POINTS } from './graph/liveSpectrumFrames';
import { SILENCE_DB } from './waveformPaint';

/**
 * What the titlebar's wave is drawn toward: every block of the capture scaled
 * to the pane by the music's own recent peak, and the flat line only after
 * real silence has lasted.
 *
 * WHY QUIET MUSIC USED TO LIE ON THE LINE. The frame was scaled by its own
 * peak with the gain stopped at +34 dB (a 0.02 floor), so anything under
 * -34 dBFS in the loopback — which carries the Windows volume, so any record
 * played softly — was drawn as that fraction of the pane: -45 dBFS at 28%,
 * -55 dBFS at 9%, hugging the centre line as though nothing were playing. And
 * it eased raw amplitudes against a settle threshold of 0.002, which is
 * -54 dBFS: a record that quiet snapped from frame to frame instead of
 * gliding, and the drawing stopped between the capture's frames. Scaled into
 * the pane FIRST, the ease runs in the pane's own units at every volume.
 *
 * WHY THE LINE FLICKERED. Nothing asked how long a silence had lasted, so a
 * gap of a few frames between two notes drew the flat line and the wave again.
 * A plain level gate was tried here once and taken out for the same reason:
 * frames filled the pane or collapsed whenever a quiet passage crossed it.
 * This one only draws the line after the silence has outlasted the hold, so a
 * passage hovering round the threshold keeps its wave.
 */

/**
 * A block whose loudest sample is under this is silence: -70 dBFS, where the
 * pane's own readout already lets its number go (`SILENCE_DB`), so the line
 * and the dash beside it agree. It is over the -84 to -90 dBFS of dither a
 * 16-bit stream carries at rest, and 25 dB under a soft record played at a
 * low Windows volume (-45 dBFS), which has to keep drawing a wave.
 */
export const WAVE_SILENCE_AMPLITUDE = 10 ** (SILENCE_DB / 20);

/**
 * How long silence lasts before the line is drawn, on the clock of the
 * blocks themselves. Ivan: "it needs to wait for 500 ms at least so is not
 * that flashy". Sound returning ends it on its first block.
 */
export const WAVE_REST_HOLD_MS = 500;

/**
 * How fast the pane's top follows the music down, as a half-life in decibels.
 * It rises to a louder block at once.
 *
 * The old normaliser divided by the eased frame's peak, which let go at a
 * 90 ms half-life in amplitude — the same answer to a 6 dB drop as a 116 ms
 * half-life in decibels — so loud music moves as it did. A 30 dB drop into a
 * soft passage is back to half the pane in 0.28 s and to 70% in 0.4 s.
 */
export const WAVE_REFERENCE_HALF_LIFE_MS = 120;

/**
 * Which clock stamps a block: the capture's audio clock when the drawing reads
 * the analyser itself, or the time a published frame arrived. A silent run is
 * only ever measured on one of them.
 */
export type TWaveClock = 'audio' | 'arrival';

export interface IWaveGate {
  /**
   * One block of the capture: its per-bucket peaks, the spectrum published
   * with it, and when it was taken on `clock`. A block already taken (the
   * same stamp again) changes nothing, so reading faster than the audio
   * arrives cannot count a silence twice. Empty samples are no capture at
   * all, not silence, and leave nothing to draw.
   */
  take(
    samples: readonly number[],
    points: readonly IChartPointData[],
    atMs: number,
    clock: TWaveClock,
  ): void;
  /** What the drawing eases toward: 0 on the centre line, 1 at the top. */
  target(): readonly number[];
  /** The spectrum to draw with it — the held one while silence is held. */
  points(): readonly IChartPointData[];
  /** Silence has begun and the last sound is still drawn. */
  isHolding(): boolean;
  /** Silence has lasted: the flat line. */
  isResting(): boolean;
}

export const createWaveGate = (): IWaveGate => {
  const target: number[] = [];
  const heldPoints: IChartPointData[] = [];
  let points: readonly IChartPointData[] = NO_POINTS;
  let reference: number | undefined;
  let silentSinceMs: number | undefined;
  let resting = false;
  let lastAtMs: number | undefined;
  let lastClock: TWaveClock | undefined;

  /** Copied, because both the reader and the pump overwrite their buffers. */
  const holdPoints = (from: readonly IChartPointData[]) => {
    while (heldPoints.length < from.length) {
      heldPoints.push({ x: 0, y: 0 });
    }
    heldPoints.length = from.length;
    for (let index = 0; index < from.length; index += 1) {
      heldPoints[index].x = from[index].x;
      heldPoints[index].y = from[index].y;
    }
    points = heldPoints;
  };

  const rest = (
    length: number,
    blockPoints: readonly IChartPointData[],
  ): void => {
    // Forgotten, so the sound that ends the silence is measured afresh rather
    // than against the record that was playing before it.
    reference = undefined;
    resting = true;
    target.length = length;
    target.fill(0);
    points = blockPoints;
  };

  return {
    take: (samples, blockPoints, atMs, clock) => {
      if (clock === lastClock && atMs === lastAtMs) {
        return;
      }
      const elapsedMs =
        clock === lastClock && lastAtMs !== undefined
          ? Math.max(0, atMs - lastAtMs)
          : 0;
      if (clock !== lastClock) {
        silentSinceMs = undefined;
      }
      lastClock = clock;
      lastAtMs = atMs;

      if (samples.length === 0) {
        reference = undefined;
        silentSinceMs = undefined;
        resting = false;
        target.length = 0;
        points = NO_POINTS;
        return;
      }

      let peak = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const magnitude = Math.abs(samples[index]);
        if (magnitude > peak) {
          peak = magnitude;
        }
      }

      if (peak < WAVE_SILENCE_AMPLITUDE) {
        silentSinceMs ??= atMs;
        // With no sound held there is nothing to wait on: a capture that
        // starts in silence, or one already resting, is the line at once.
        if (
          reference === undefined ||
          target.length !== samples.length ||
          atMs - silentSinceMs >= WAVE_REST_HOLD_MS
        ) {
          rest(samples.length, blockPoints);
        }
        return;
      }

      silentSinceMs = undefined;
      resting = false;
      if (reference === undefined || peak >= reference) {
        reference = peak;
      } else {
        // An exponential approach in decibels: the same share of the gap is
        // closed in every half-life, however far the music has fallen.
        const share = 1 - 2 ** (-elapsedMs / WAVE_REFERENCE_HALF_LIFE_MS);
        reference *= (peak / reference) ** share;
      }
      const gain = 1 / reference;
      target.length = samples.length;
      for (let index = 0; index < samples.length; index += 1) {
        target[index] = Math.min(1, Math.abs(samples[index]) * gain);
      }
      holdPoints(blockPoints);
    },
    target: () => target,
    points: () => points,
    isHolding: () => silentSinceMs !== undefined && !resting,
    isResting: () => resting,
  };
};
