/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDeEsserSettings, TDeEsserMode } from '../../common/dsp/deEsser';
import { GRAPH_FONT } from './deEsserPlot';
import type { IDeEsserInks, IPlotBox } from './deEsserPlot';

/**
 * What the De-esser's lens pictures share (`deEsserLens.ts`): the words they
 * print, the engine's constants they are drawn from, and the strokes.
 */

/** Which control is being tuned, with what a choice is pointing at. */
export type TDeEsserTune =
  | {
      control:
        | 'sensitivity'
        | 'listening'
        | 'depth'
        | 'width'
        | 'attack'
        | 'release'
        | 'keepCymbals';
    }
  | { control: 'mode'; mode: TDeEsserMode }
  | { control: 'where'; centreOnly: boolean };

export interface ILensLabels {
  voice: string;
  cymbal: string;
  s: string;
  cut: string;
  threshold: string;
  trebleNow: string;
  left: string;
  right: string;
  attack: string;
  release: string;
  /** "{db} under the voice". */
  underVoice: (db: string) => string;
  /** "up to {db}". */
  upTo: (db: string) => string;
  /** "heard {ms} ahead". */
  ahead: (ms: string) => string;
  /** "a cymbal needs {db} more". */
  cymbalNeeds: (db: string) => string;
  modes: Readonly<Record<TDeEsserMode, string>>;
  centre: string;
  everything: string;
}

/** One picture's inputs: where, what the stage is set to, and how to say it. */
export interface ILensPicture {
  context: CanvasRenderingContext2D;
  box: IPlotBox;
  settings: IDeEsserSettings;
  inks: IDeEsserInks;
  labels: ILensLabels;
}

/** Sensitivity's two comparisons (`build_layout`): this is the body's. */
export const bodyThresholdDb = (sensitivity: number) => -8 - 10 * sensitivity;
/** `FEQ_DEESSER_LOOK_AHEAD_MS`. */
export const LOOK_AHEAD_MS = 2;
/** `kSpareDb`: how much higher a sure non-voice stands at Keep cymbals 100%. */
export const SPARE_DB = 40;
/** `kSlope`: above its threshold a band is cut by 5/6 of its overshoot. */
export const CUT_SLOPE = 5 / 6;
/** `kCentreFrom` and `kCentreSure`: the centre's share read as side and voice. */
export const CENTRE_FROM = 0.55;
export const CENTRE_SURE = 0.9;

/** The ink and the face the picture's own point is written in. */
export const POINT_INK = 'rgba(255,255,255,0.95)';
export const POINT_FONT = `600 ${GRAPH_FONT}`;

export const line = (
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();
};

export const label = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  ink: string,
) => {
  context.textAlign = align;
  context.fillStyle = ink;
  context.fillText(text, x, y);
};

/** The sign a figure is printed with: the typographic minus, as every readout. */
const signOf = (value: number) => {
  if (value < 0) {
    return '−';
  }
  return value > 0 ? '+' : '';
};

export const signed = (value: number, digits: number) =>
  `${signOf(value)}${Math.abs(value).toFixed(digits)}`;

/** A distance in dB, which has no sign: "13.5 dB under the voice". */
export const distanceDb = (db: number) => `${Math.abs(db).toFixed(1)} dB`;

/** A soft glow under the strokes that carry the picture's point. */
export const glow = (
  context: CanvasRenderingContext2D,
  ink: string,
  blur: number,
) => {
  context.shadowColor = `rgba(${ink},0.55)`;
  context.shadowBlur = blur;
};

export const noGlow = (context: CanvasRenderingContext2D) => {
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
};

/** On a log axis from `low` to `high` across the box. */
export const xOfHz = (box: IPlotBox, hz: number, low: number, high: number) =>
  box.x + (Math.log(hz / low) / Math.log(high / low)) * box.width;

const NICE_UNITS: readonly (readonly [number, number])[] = [
  [1.5, 1],
  [3.5, 2],
  [7.5, 5],
];

/** A round step for an axis that runs to `to`: four to eight ticks. */
export const niceStep = (to: number) => {
  const raw = to / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = NICE_UNITS.find(([below]) => unit < below);
  return (nice ? nice[1] : 10) * power;
};
