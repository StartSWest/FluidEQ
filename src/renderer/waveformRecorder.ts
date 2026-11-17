/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Recorder meter: an ordinary audio waveform passing right to left — one
 * filled shape, mirrored around the centre line, in one colour (Ivan,
 * 2026-11-16: "a true waveform, to see the wave of the music passing by";
 * then, of busier versions, "just a normal waveform", and "a bit more
 * compressed in time so it shows more compact").
 *
 * Three versions came back that evening, each for drawing more than that: a
 * colour per column and the channels split, then a column per device pixel
 * whose edge read as hairs and dots ("I don't want a dotted style"), then a
 * smooth shape still carrying an RMS body, a gradient and red clip marks. What
 * is left is the shape, as a path: one closed contour through an envelope
 * that rises fast and falls slower from column to column, so the edge is a
 * soft continuous line and never a comb.
 *
 * WHAT A COLUMN IS. One CSS pixel of width is a slice of time — the strip
 * moves `SCROLL_CSS_PX_PER_SECOND`, so a 420px strip holds about nine
 * seconds — and its height is the loudest sample of either channel in that
 * slice. Every sample counts, not the analyser's window resampled:
 * `waveformSampleCursor.ts` hands over exactly the samples that are new since
 * the last frame. The amplitude is linear, as an audio editor draws it.
 *
 * HOW IT DRAWS. The whole visible shape again on every frame, from the
 * history: about four hundred points and one fill, less than the meter's
 * other styles draw. Placed by the part of a column already heard as well as
 * by whole columns, so the scroll moves at the audio's own rate on any
 * display rather than in steps of a column.
 */
import { CLIP_RAIL_AMPLITUDE } from './graph/liveSpectrumFrames';

/** How fast the music passes, in CSS pixels a second. */
export const SCROLL_CSS_PX_PER_SECOND = 45;
/** A column quieter than this is silence. */
const SIGNAL_FLOOR = 0.002;
/**
 * The envelope's share of the way to a louder column, and to a quieter one:
 * a hit lands within two columns and lets go over about five, so the
 * music keeps its shape while the outline stays one soft line.
 */
const RISE = 0.6;
const FALL = 0.3;
/** The fewest columns the history holds. */
const MIN_CAPACITY = 1024;

export interface IRecorderPalette {
  /** The shape. */
  fill: string;
  /** The shape while the capture is paused. */
  paused: string;
}

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
   * readings (another PC's), or silence (0).
   */
  feedLevel(peak: number, durationMs: number): void;
  /** One frame. Answers whether anything not silent is still on screen. */
  draw(context: CanvasRenderingContext2D, input: IRecorderDraw): boolean;
  /** Forget the music: an empty strip from the next frame. */
  clear(): void;
}

export const createWaveRecorder = (): IWaveRecorder => {
  // The history, newest at `head`, one envelope value per CSS pixel.
  let capacity = MIN_CAPACITY;
  let outlines = new Float32Array(capacity);
  let head = -1;
  let filled = 0;
  /** Columns since the last one with anything in it. */
  let sinceSignal = Number.POSITIVE_INFINITY;
  let outline = 0;

  // The column being filled; `columnPhase` is how much of it is heard.
  let peak = 0;
  let columnPhase = 0;
  let perColumn = 48_000 / SCROLL_CSS_PX_PER_SECOND;
  let levelPhase = 0;

  const grow = (needed: number) => {
    if (needed <= capacity) {
      return;
    }
    let size = capacity;
    while (size < needed) {
      size *= 2;
    }
    const keep = Math.min(filled, capacity);
    const next = new Float32Array(size);
    // Oldest first from index 0, so the newest lands at `keep - 1`.
    for (let age = 0; age < keep; age += 1) {
      next[keep - 1 - age] = outlines[(head - age + capacity) % capacity];
    }
    outlines = next;
    capacity = size;
    head = keep - 1;
    filled = keep;
  };

  const push = (columnPeak: number) => {
    head = (head + 1) % capacity;
    outline += (columnPeak - outline) * (columnPeak > outline ? RISE : FALL);
    outlines[head] = outline;
    filled = Math.min(capacity, filled + 1);
    sinceSignal = outline > SIGNAL_FLOOR ? 0 : sinceSignal + 1;
  };

  return {
    feed: (channels, from, to, unseen, sampleRate) => {
      const count = Math.min(2, channels.length);
      if (count === 0) {
        return;
      }
      perColumn = sampleRate / SCROLL_CSS_PX_PER_SECOND;
      // Unseen audio closes the column it fell in and passes as empty
      // columns: counted, not walked a sample at a time.
      if (unseen > 0) {
        let rest = unseen;
        if (columnPhase + rest >= perColumn) {
          rest -= perColumn - columnPhase;
          push(peak);
          peak = 0;
          const whole = Math.floor(rest / perColumn);
          for (let index = 0; index < Math.min(whole, capacity); index += 1) {
            push(0);
          }
          rest -= whole * perColumn;
          columnPhase = 0;
        }
        columnPhase += rest;
      }
      for (let frame = from; frame < to; frame += 1) {
        for (let channel = 0; channel < count; channel += 1) {
          // Held at the rail: a sample past full scale is drawn at it.
          const magnitude = Math.min(
            CLIP_RAIL_AMPLITUDE,
            Math.abs(channels[channel][frame]),
          );
          if (magnitude > peak) {
            peak = magnitude;
          }
        }
        columnPhase += 1;
        if (columnPhase >= perColumn) {
          columnPhase -= perColumn;
          push(peak);
          peak = 0;
        }
      }
    },

    feedLevel: (level, durationMs) => {
      levelPhase += (durationMs / 1000) * SCROLL_CSS_PX_PER_SECOND;
      const whole = Math.floor(levelPhase);
      levelPhase -= whole;
      for (let index = 0; index < Math.min(whole, capacity); index += 1) {
        push(level);
      }
    },

    draw: (context, { box, ratio, palette, isPaused }) => {
      const { canvas } = context;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const columns = Math.ceil(box.width) + 2;
      grow(columns);
      const centre = box.y + box.height / 2;
      // A pixel short of each edge, so a full-scale outline stays inside.
      const reach = box.height / 2 - 1;
      const right = box.x + box.width;
      // The part of the newest column already heard moves the whole shape,
      // so it slides on every frame instead of a column at a time.
      const slide = isPaused ? 0 : Math.min(1, columnPhase / perColumn);
      const shown = Math.min(filled, columns);
      const xAt = (age: number) => right - age - slide;
      const yAt = (age: number) =>
        outlines[(head - age + capacity) % capacity] * reach;

      // No centre line under it (Ivan, 2026-11-17: "dont show the centr line"):
      // silence is an empty strip.
      if (shown < 2) {
        return false;
      }
      context.save();
      context.beginPath();
      context.rect(box.x, box.y, box.width, box.height);
      context.clip();
      // Each point is the control of a curve between the midpoints to its
      // neighbours, so the outline has no corners at all.
      const edge = (age: number, side: 1 | -1) => centre + side * yAt(age);
      const through = (from: number, to: number, side: 1 | -1) => {
        const step = to > from ? 1 : -1;
        for (let age = from; age !== to; age += step) {
          context.quadraticCurveTo(
            xAt(age),
            edge(age, side),
            (xAt(age) + xAt(age + step)) / 2,
            (edge(age, side) + edge(age + step, side)) / 2,
          );
        }
        context.lineTo(xAt(to), edge(to, side));
      };
      context.beginPath();
      context.moveTo(xAt(shown - 1), edge(shown - 1, -1));
      through(shown - 1, 0, -1);
      context.lineTo(xAt(0), edge(0, 1));
      through(0, shown - 1, 1);
      context.closePath();
      context.fillStyle = isPaused ? palette.paused : palette.fill;
      context.fill();
      context.restore();
      return !isPaused && sinceSignal < columns;
    },

    clear: () => {
      head = -1;
      filled = 0;
      sinceSignal = Number.POSITIVE_INFINITY;
      outline = 0;
      peak = 0;
      columnPhase = 0;
      levelPhase = 0;
    },
  };
};
