/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Recorder meter: the output's waveform passing right to left as a
 * recording program's overview draws a track — one filled shape, mirrored
 * around the centre line (Ivan, 2026-11-16: "a true waveform, to see the wave
 * of the music passing by and see real distortion and loudness"; and of a
 * first, busier version, "just a standard filled wave that looks useful").
 *
 * WHAT A COLUMN IS. One device pixel of width is a slice of time — the strip
 * moves `SCROLL_CSS_PX_PER_SECOND`, so a 420px strip holds three and a half
 * seconds — and every sample the capture rendered in that slice lands in it:
 * the loudest sample of either channel is the shape's height, the RMS of both
 * a denser core inside it, and a sample on the rail (the capture's own
 * `CLIP_RAIL_AMPLITUDE`) a thin red mark at the shape's two edges. Every
 * sample, not the analyser's window resampled: `waveformSampleCursor.ts` hands
 * over exactly the samples that are new since the last frame, so a limiter's
 * flat top, a clipped run and a quiet bar between two hits read as what they
 * are. The amplitude is linear, as a recording program draws it.
 *
 * ONE COLOUR. The accent; in Colourful the mode's palette as a single smooth
 * gradient from the centre line out. A colour per row rather than per column
 * is also what lets the history move as pixels: a row keeps its colour
 * wherever the column it belongs to has scrolled.
 *
 * HOW IT DRAWS. Only the new columns. The pixels already on screen move left
 * by a copy of the canvas onto itself, and the columns that arrived since the
 * last frame are written into an `ImageData` and put at the right edge — no
 * path, no history redrawn. The whole strip is painted again only when its
 * size, its colours or pausing change.
 */
import { CLIP_RAIL_AMPLITUDE } from './graph/liveSpectrumFrames';
import {
  type IRecorderInk,
  type IRecorderPalette,
  paletteKey,
  resolveRecorderInk,
} from './waveformRecorderInk';

/** How fast the music passes, whatever the screen's scale. */
export const SCROLL_CSS_PX_PER_SECOND = 120;
/** A column quieter than this draws nothing past the centre line. */
const SIGNAL_FLOOR = 0.002;
/** The shape is the colour at this alpha; its RMS core is solid. */
const BODY_ALPHA = 0.5;
/** The fewest columns the history holds. */
const MIN_CAPACITY = 1024;

export interface IRecorderBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IRecorderDraw {
  /** Where the strip is, in CSS pixels. */
  box: IRecorderBox;
  /** Device pixels per CSS pixel. */
  ratio: number;
  palette: IRecorderPalette;
  isPaused: boolean;
}

export interface IWaveRecorder {
  /**
   * New samples, `from`..`to` of each channel (the first two), after
   * `unseen` samples nobody saw, which pass as silence.
   */
  feed(
    channels: readonly Float32Array[],
    from: number,
    to: number,
    unseen: number,
    sampleRate: number,
  ): void;
  /**
   * `durationMs` at one level, for audio known only by its published
   * readings (another PC's), or silence (0, 0).
   */
  feedLevel(peak: number, rms: number, durationMs: number): void;
  /** One frame. Answers whether anything not silent is still on screen. */
  draw(context: CanvasRenderingContext2D, input: IRecorderDraw): boolean;
  /** The canvas was painted by somebody else: repaint all of it next frame. */
  invalidate(): void;
  /** Forget the music: an empty strip from the next frame. */
  clear(): void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Rows from the centre for an amplitude: anything heard is at least one. */
const rowsFor = (amplitude: number, laneRows: number) =>
  amplitude > SIGNAL_FLOOR
    ? Math.max(1, Math.round(clamp01(amplitude) * laneRows))
    : 0;

export const createWaveRecorder = (): IWaveRecorder => {
  // The history, newest at `head`, one entry per device column.
  let capacity = 0;
  let peaks = new Float32Array(0);
  let rmses = new Float32Array(0);
  /** 1 where a sample railed in the column. */
  let clips = new Uint8Array(0);
  let head = -1;
  let filled = 0;
  /** Columns taken since the last frame drew. */
  let pending = 0;
  /** Columns since the last one with anything in it. */
  let sinceSignal = Number.POSITIVE_INFINITY;

  // The column being filled.
  let peak = 0;
  let sumSquares = 0;
  let clipped = false;
  let columnSamples = 0;
  let columnPhase = 0;
  let levelPhase = 0;

  // Device columns per second, from the last frame's scale.
  let columnsPerSecond = SCROLL_CSS_PX_PER_SECOND;

  // What the canvas holds.
  let image: ImageData | undefined;
  let drawnKey = '';
  let inkKey = '';
  let ink: IRecorderInk | undefined;
  let isInvalid = true;

  const grow = (needed: number) => {
    if (needed <= capacity) {
      return;
    }
    let size = Math.max(MIN_CAPACITY, capacity);
    while (size < needed) {
      size *= 2;
    }
    const keep = Math.min(filled, capacity);
    const nextPeaks = new Float32Array(size);
    const nextRmses = new Float32Array(size);
    const nextClips = new Uint8Array(size);
    // Oldest first from index 0, so the newest lands at `keep - 1`.
    for (let age = 0; age < keep; age += 1) {
      const from = (head - age + capacity) % capacity;
      nextPeaks[keep - 1 - age] = peaks[from];
      nextRmses[keep - 1 - age] = rmses[from];
      nextClips[keep - 1 - age] = clips[from];
    }
    peaks = nextPeaks;
    rmses = nextRmses;
    clips = nextClips;
    capacity = size;
    head = keep - 1;
    filled = keep;
  };

  const push = (columnPeak: number, columnRms: number, railed: boolean) => {
    grow(1);
    head = (head + 1) % capacity;
    peaks[head] = columnPeak;
    rmses[head] = columnRms;
    clips[head] = railed ? 1 : 0;
    filled = Math.min(capacity, filled + 1);
    pending = Math.min(capacity, pending + 1);
    sinceSignal = columnPeak > SIGNAL_FLOOR ? 0 : sinceSignal + 1;
  };

  /** The column being filled, closed and kept. */
  const closeColumn = (channelCount: number) => {
    push(
      peak,
      Math.sqrt(sumSquares / Math.max(1, columnSamples * channelCount)),
      clipped,
    );
    peak = 0;
    sumSquares = 0;
    clipped = false;
    columnSamples = 0;
  };

  /** Pushing more columns than the history holds would only be overwritten. */
  const mostColumns = () => Math.max(capacity, MIN_CAPACITY);

  return {
    feed: (channels, from, to, unseen, sampleRate) => {
      const count = Math.min(2, channels.length);
      if (count === 0) {
        return;
      }
      const perColumn = sampleRate / columnsPerSecond;
      // Unseen audio closes the column it fell in and passes as empty
      // columns: counted, not walked a sample at a time.
      if (unseen > 0) {
        let rest = unseen;
        if (columnPhase + rest >= perColumn) {
          rest -= perColumn - columnPhase;
          columnSamples += Math.round(perColumn - columnPhase);
          closeColumn(count);
          const whole = Math.floor(rest / perColumn);
          const shown = Math.min(whole, mostColumns());
          for (let index = 0; index < shown; index += 1) {
            push(0, 0, false);
          }
          rest -= whole * perColumn;
          columnPhase = 0;
        }
        columnPhase += rest;
        columnSamples += Math.round(rest);
      }
      for (let frame = from; frame < to; frame += 1) {
        for (let channel = 0; channel < count; channel += 1) {
          const sample = channels[channel][frame];
          const magnitude = Math.abs(sample);
          if (magnitude > peak) {
            peak = magnitude;
          }
          if (magnitude >= CLIP_RAIL_AMPLITUDE) {
            clipped = true;
          }
          sumSquares += sample * sample;
        }
        columnSamples += 1;
        columnPhase += 1;
        if (columnPhase >= perColumn) {
          columnPhase -= perColumn;
          closeColumn(count);
        }
      }
    },

    feedLevel: (level, rms, durationMs) => {
      levelPhase += (durationMs / 1000) * columnsPerSecond;
      const whole = Math.floor(levelPhase);
      levelPhase -= whole;
      const shown = Math.min(whole, mostColumns());
      for (let index = 0; index < shown; index += 1) {
        push(level, rms, false);
      }
    },

    draw: (context, { box, ratio, palette, isPaused }) => {
      const { canvas } = context;
      columnsPerSecond = SCROLL_CSS_PX_PER_SECOND * ratio;
      const left = Math.round(box.x * ratio);
      const top = Math.round(box.y * ratio);
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(3, Math.round(box.height * ratio));
      grow(width);

      const key = paletteKey(palette);
      if (key !== inkKey || !ink) {
        inkKey = key;
        ink = resolveRecorderInk(palette);
        isInvalid = true;
      }
      if (!ink) {
        return false;
      }
      const geometry = `${canvas.width}x${canvas.height}@${left},${top},${width},${height}|${isPaused}`;
      if (geometry !== drawnKey) {
        drawnKey = geometry;
        isInvalid = true;
      }
      if (!image || image.width !== width || image.height !== height) {
        image = context.createImageData(width, height);
        isInvalid = true;
      }

      const { data } = image;
      const stride = width * 4;
      // One row of centre line and the same number of rows either side of
      // it; an even height leaves its last row empty.
      const centre = Math.floor((height - 1) / 2);
      const laneRows = centre;
      // The rail's mark: a pixel at a screen's own scale, two on a dense one.
      const markRows = Math.max(1, Math.round(ratio));
      const { ramp, unlit, paused, hot } = ink;

      const put = (
        offset: number,
        source: Uint8ClampedArray,
        at: number,
        alpha: number,
      ) => {
        data[offset] = source[at];
        data[offset + 1] = source[at + 1];
        data[offset + 2] = source[at + 2];
        data[offset + 3] = source[at + 3] * alpha;
      };
      /** The body's colour `step` rows from the centre: the ramp, outward. */
      const tint = (offset: number, step: number, alpha: number) => {
        if (isPaused) {
          put(offset, paused, 0, alpha);
        } else {
          put(offset, ramp, Math.round((step / laneRows) * 255) * 4, alpha);
        }
      };

      const paintColumns = (fromX: number) => {
        for (let x = fromX; x < width; x += 1) {
          const age = width - 1 - x;
          const at = (head - age + capacity) % capacity;
          const isKept = age < filled;
          const peakRows = isKept ? rowsFor(peaks[at], laneRows) : 0;
          const rmsRows = isKept
            ? Math.min(peakRows, rowsFor(rmses[at], laneRows))
            : 0;
          const railed = isKept && clips[at] === 1;
          data[(height - 1) * stride + x * 4 + 3] = 0;
          if (peakRows > 0) {
            tint(centre * stride + x * 4, 0, 1);
          } else {
            put(centre * stride + x * 4, unlit, 0, 1);
          }
          for (let step = 1; step <= laneRows; step += 1) {
            const above = (centre - step) * stride + x * 4;
            const below = (centre + step) * stride + x * 4;
            if (step > peakRows) {
              data[above + 3] = 0;
              data[below + 3] = 0;
            } else if (railed && step > peakRows - markRows) {
              put(above, hot, 0, 1);
              put(below, hot, 0, 1);
            } else {
              const alpha = step <= rmsRows ? 1 : BODY_ALPHA;
              tint(above, step, alpha);
              tint(below, step, alpha);
            }
          }
        }
      };

      if (isInvalid) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        paintColumns(0);
        context.putImageData(image, left, top);
        isInvalid = false;
        pending = 0;
      } else if (pending > 0) {
        const shift = Math.min(pending, width);
        if (shift < width) {
          // The canvas onto itself, a whole number of device pixels left,
          // replacing what was there: `copy`, held inside the strip by the
          // clip, so nothing outside it is touched.
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.beginPath();
          context.rect(left, top, width - shift, height);
          context.clip();
          context.globalCompositeOperation = 'copy';
          context.imageSmoothingEnabled = false;
          context.drawImage(
            canvas,
            left + shift,
            top,
            width - shift,
            height,
            left,
            top,
            width - shift,
            height,
          );
          context.restore();
        }
        paintColumns(width - shift);
        context.putImageData(image, left, top, width - shift, 0, shift, height);
        pending = 0;
      }
      return !isPaused && sinceSignal < width;
    },

    invalidate: () => {
      isInvalid = true;
    },

    clear: () => {
      head = -1;
      filled = 0;
      pending = 0;
      sinceSignal = Number.POSITIVE_INFINITY;
      peak = 0;
      sumSquares = 0;
      clipped = false;
      columnSamples = 0;
      columnPhase = 0;
      levelPhase = 0;
      isInvalid = true;
    },
  };
};
