/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The last half-minute of how loud the record is, against the line it is aimed
 * at.
 *
 * This replaces a log-frequency spectrum, and the reason is the same one
 * `DspMaximizerGraph` gives for not drawing one either: a loudness target has
 * no opinion about frequency. It treats 40 Hz and 12 kHz by the same
 * K-weighted rule and acts on the level of the moment, so a spectrum here was
 * very nearly the picture the EQ page already draws, with nothing of THIS
 * stage in it — and it left the one quantity the page is about, loudness,
 * completely undrawn. The target was a number in a dial with nothing on screen
 * to check it against, which is how a makeup that applied exactly zero
 * decibels to every commercially mastered track shipped unnoticed.
 *
 * The axis that means something here is time, and the shapes that mean
 * something are three: the short-term line riding the target, the momentary
 * fill moving under it, and the reduction the limiter is buying that with.
 * Drawn together because they are one decision — you cannot read whether a
 * target was reached by mastering or by flattening from any one of them alone.
 *
 * Painting only. The component owns the history, the holds and the strings, so
 * that this file has no state to get out of step with the numbers beside it.
 */

/** How much history the strip holds. Loudness moves slowly; six seconds lies. */
export const LOUDNESS_WINDOW_MS = 30_000;

/**
 * One column per sample, at the meter's own 100 ms hop.
 *
 * Sampling faster would draw the same value several times; slower would step
 * over blocks the engine measured. The hop is not a display choice — it is the
 * rate at which a new momentary block exists at all.
 */
export const LOUDNESS_SAMPLE_MS = 100;

export const LOUDNESS_HISTORY = Math.ceil(
  LOUDNESS_WINDOW_MS / LOUDNESS_SAMPLE_MS,
);

/** The scale's ends. Below the floor a reading is drawn as absent, not as low. */
const TOP_LUFS = 0;
const FLOOR_LUFS = -36;
const GRID_LUFS = [0, -6, -12, -18, -24, -30, -36];

/** Full deflection of the reduction meter, matching the Maximizer's scale. */
const GR_FULL_SCALE_DB = 12;

const PAD_L = 44;
/** Room for the reduction meter and its scale, which live in this margin. */
const PAD_R = 62;
/**
 * The legend and the status chips own two fixed rows above the plot, at the
 * heights the stylesheet puts them. Drawing under either one made the readings
 * look like they were labelling whatever passed behind them.
 */
const PAD_T = 64;
const PAD_B = 22;

const FONT =
  '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/** What the painter is handed. Every array is a ring; `head` is next to write. */
export interface IMasterLoudnessPlot {
  momentary: Float32Array;
  shortTerm: Float32Array;
  reduction: Float32Array;
  head: number;
  filled: number;
  integratedLufs: number;
  targetLufs: number;
  liveReductionDb: number;
  /** Whether the target line means anything yet. */
  targetActive: boolean;
  overCeiling: boolean;
  targetLabel: string;
  integratedLabel: string;
  reductionLabel: string;
}

const TEAL_FILL = 'rgba(0,229,207,0.14)';
const TEAL_LINE = 'rgba(64,214,200,0.96)';
const AMBER = 'rgba(255,176,89,0.85)';
const AMBER_FILL = 'rgba(255,176,89,0.16)';
const RED = 'rgba(255,88,112,0.92)';
const INTEGRATED = 'rgba(226,236,255,0.8)';

export const paintMasterLoudness = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plot: IMasterLoudnessPlot,
): void => {
  const plotWidth = Math.max(1, width - PAD_L - PAD_R);
  const plotHeight = Math.max(1, height - PAD_T - PAD_B);
  const lufsY = (lufs: number): number =>
    PAD_T +
    ((TOP_LUFS - Math.max(FLOOR_LUFS, Math.min(TOP_LUFS, lufs))) /
      (TOP_LUFS - FLOOR_LUFS)) *
      plotHeight;
  /**
   * Oldest at the left, newest at the right edge, which is where the eye is.
   *
   * `age` counts back from the newest sample, so a partly filled ring draws
   * only what it has instead of a wall of floor values scrolling in.
   */
  const columnX = (age: number): number =>
    PAD_L + plotWidth - (age / LOUDNESS_HISTORY) * plotWidth;
  const sampleAt = (age: number): number =>
    (plot.head - 1 - age + LOUDNESS_HISTORY * 2) % LOUDNESS_HISTORY;

  context.font = FONT;
  context.textBaseline = 'middle';
  GRID_LUFS.forEach((lufs) => {
    const y = Math.round(lufsY(lufs)) + 0.5;
    context.strokeStyle =
      lufs === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)';
    context.beginPath();
    context.moveTo(PAD_L, y);
    context.lineTo(width - PAD_R, y);
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,0.38)';
    context.textAlign = 'right';
    context.fillText(`${lufs}`, PAD_L - 7, y);
  });
  // The unit, once, where a stray number on the axis could be read as dB.
  context.fillStyle = 'rgba(255,255,255,0.28)';
  context.textAlign = 'right';
  context.fillText('LUFS', PAD_L - 7, PAD_T - 10);

  const visible = Math.min(plot.filled, LOUDNESS_HISTORY);

  /**
   * The reduction, hung from the top of the plot rather than plotted as a
   * value.
   *
   * It is not a loudness and has no place on the LUFS axis, but it belongs on
   * the same time axis: the whole question this page answers is whether the
   * short-term line reached the target by mastering or by being held down, and
   * that is only readable when the two are drawn over the same seconds.
   */
  if (visible > 1) {
    context.beginPath();
    context.moveTo(columnX(visible - 1), PAD_T);
    for (let age = visible - 1; age >= 0; age -= 1) {
      const depth = Math.min(
        1,
        Math.abs(plot.reduction[sampleAt(age)]) / GR_FULL_SCALE_DB,
      );
      context.lineTo(columnX(age), PAD_T + depth * plotHeight * 0.5);
    }
    context.lineTo(columnX(0), PAD_T);
    context.closePath();
    context.fillStyle = AMBER_FILL;
    context.fill();
  }

  if (visible > 1) {
    const floorY = height - PAD_B;
    context.beginPath();
    context.moveTo(columnX(visible - 1), floorY);
    for (let age = visible - 1; age >= 0; age -= 1) {
      context.lineTo(columnX(age), lufsY(plot.momentary[sampleAt(age)]));
    }
    context.lineTo(columnX(0), floorY);
    context.closePath();
    context.fillStyle = TEAL_FILL;
    context.fill();

    context.beginPath();
    for (let age = visible - 1; age >= 0; age -= 1) {
      const y = lufsY(plot.shortTerm[sampleAt(age)]);
      if (age === visible - 1) {
        context.moveTo(columnX(age), y);
      } else {
        context.lineTo(columnX(age), y);
      }
    }
    context.strokeStyle = TEAL_LINE;
    context.lineWidth = 2;
    context.stroke();
  }

  if (plot.targetActive) {
    const targetY = Math.round(lufsY(plot.targetLufs)) + 0.5;
    context.save();
    context.setLineDash([4, 5]);
    context.strokeStyle = plot.overCeiling ? RED : AMBER;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(PAD_L, targetY);
    context.lineTo(width - PAD_R, targetY);
    context.stroke();
    context.restore();
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = plot.overCeiling ? RED : 'rgba(255,196,126,0.9)';
    context.fillText(plot.targetLabel, PAD_L + 8, targetY - 4);
    context.textBaseline = 'middle';
  }

  if (plot.integratedLufs > FLOOR_LUFS) {
    const integratedY = Math.round(lufsY(plot.integratedLufs)) + 0.5;
    context.save();
    context.setLineDash([1, 4]);
    context.strokeStyle = INTEGRATED;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(PAD_L, integratedY);
    context.lineTo(width - PAD_R, integratedY);
    context.stroke();
    context.restore();
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillStyle = INTEGRATED;
    context.fillText(plot.integratedLabel, width - PAD_R - 8, integratedY - 4);
    context.textBaseline = 'middle';
  }

  /**
   * The live reduction as a bar in the right margin, falling from the top.
   *
   * Duplicating the band above on purpose: the band says what the limiter has
   * been doing over half a minute and this says what it is doing now, and the
   * second question is the one asked while a dial is being moved.
   */
  const meterX = width - PAD_R + 16;
  const meterWidth = 12;
  context.fillStyle = 'rgba(255,255,255,0.06)';
  context.fillRect(meterX, PAD_T, meterWidth, plotHeight);
  const depth = Math.min(1, Math.abs(plot.liveReductionDb) / GR_FULL_SCALE_DB);
  if (depth > 0) {
    context.fillStyle = AMBER;
    context.fillRect(meterX, PAD_T, meterWidth, depth * plotHeight);
  }
  context.textAlign = 'left';
  context.fillStyle = 'rgba(255,255,255,0.38)';
  context.fillText('0', meterX + meterWidth + 5, PAD_T + 5);
  context.fillText(
    `-${GR_FULL_SCALE_DB}`,
    meterX + meterWidth + 5,
    PAD_T + plotHeight - 5,
  );
  context.textAlign = 'center';
  context.fillStyle =
    depth > 0 ? 'rgba(255,196,126,0.9)' : 'rgba(255,255,255,0.3)';
  context.fillText(
    plot.reductionLabel,
    meterX + meterWidth / 2,
    height - PAD_B / 2,
  );

  // Seconds, so the width of the picture is a duration rather than a guess.
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255,255,255,0.38)';
  for (let seconds = 0; seconds <= LOUDNESS_WINDOW_MS / 1000; seconds += 10) {
    const age = (seconds * 1000) / LOUDNESS_SAMPLE_MS;
    const label = seconds === 0 ? 'now' : `-${seconds}s`;
    context.fillText(label, columnX(age), height - PAD_B / 2);
  }
};
