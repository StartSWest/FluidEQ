/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DE_ESSER_RANGES,
  IDeEsserSettings,
  TDeEsserMode,
} from '../../common/dsp/deEsser';
import { cutAt, GRAPH_FONT, ITrebleNow } from './deEsserPlot';
import {
  bodyThresholdDb,
  distanceDb,
  glow,
  ILensPicture,
  label,
  line,
  noGlow,
  POINT_FONT,
  POINT_INK,
  signed,
  xOfHz,
} from './deEsserLensKit';

/**
 * The lens pictures read against frequency or level: Sensitivity's line,
 * and the cut's shape for Up to, Width and the three ways of cutting.
 */

const LOW_HZ = 2000;
const HIGH_HZ = 20000;
const WIDE_LOW_HZ = 20;

/**
 * The bands the engine lays out over a range (`build_layout`): a third of an
 * octave apart, evenly, from one edge to the other.
 */
export const deEsserBandsHz = (lowHz: number, highHz: number): number[] => {
  const span = Math.log2(highHz / lowHz);
  const count = Math.min(12, Math.max(2, Math.round(span * 3) + 1));
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, band) => lowHz * 2 ** (step * band));
};

/**
 * The cut one S at `sHz` asks for, band by band, at the dial's depth: its
 * own band the whole depth and its neighbours by the spread (`spread` in
 * `build_layout`), `2^-(2d/width)^2` for `d` octaves away.
 */
const sCut = (settings: IDeEsserSettings, sHz: number): ITrebleNow => {
  const hz = deEsserBandsHz(settings.lowHz, settings.highHz);
  const nearest = hz.reduce(
    (best, centre) =>
      Math.abs(Math.log2(centre / sHz)) < Math.abs(Math.log2(best / sHz))
        ? centre
        : best,
    hz[0] ?? sHz,
  );
  const cutDb = hz.map((centre) => {
    const scaled =
      (2 * Math.abs(Math.log2(centre / nearest))) / settings.widthOct;
    return -settings.rangeDb * 2 ** (-scaled * scaled);
  });
  return {
    hz,
    levelDb: hz.map(() => -120),
    thresholdDb: hz.map(() => 0),
    cutDb,
    sHz: nearest,
    sAlpha: 1,
  };
};

/**
 * Sensitivity: where on the treble's level, against the voice's body, the
 * stage starts — and the treble now against that line, so the dial is seen
 * catching the S's or letting them by.
 */
export const drawSensitivity = (
  { context, box, settings, inks, labels }: ILensPicture,
  sibilanceDb: number,
) => {
  // An S's loudest band reads about 8 dB under the voice's body
  // (`build_layout`); a harsh one stands over it.
  const fromDb = -36;
  const toDb = 12;
  // In far enough that the figures at both ends are whole.
  const left = box.x + 16;
  const width = box.width - 32;
  const xOf = (db: number) =>
    left +
    ((Math.max(fromDb, Math.min(toDb, db)) - fromDb) / (toDb - fromDb)) * width;
  const trackY = box.y + box.height * 0.5;
  const trackH = Math.min(22, box.height * 0.16);
  const trackTop = trackY - trackH / 2;
  const trackBottom = trackY + trackH / 2;
  const threshold = bodyThresholdDb(settings.sensitivity);
  const at = xOf(threshold);

  // The track, its cut zone right of where it starts.
  context.fillStyle = 'rgba(255,255,255,0.06)';
  context.beginPath();
  context.roundRect(left, trackTop, width, trackH, trackH / 2);
  context.fill();
  const zone = context.createLinearGradient(at, 0, left + width, 0);
  zone.addColorStop(0, `rgba(${inks.cut},0.55)`);
  zone.addColorStop(1, `rgba(${inks.cut},0.18)`);
  context.fillStyle = zone;
  context.beginPath();
  context.roundRect(at, trackTop, left + width - at, trackH, [
    0,
    trackH / 2,
    trackH / 2,
    0,
  ]);
  context.fill();
  label(context, labels.cut, at + 8, trackY, 'left', `rgba(${inks.cut},1)`);

  // Every 6 dB under the track.
  context.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let db = fromDb; db <= toDb; db += 6) {
    const x = Math.round(xOf(db)) + 0.5;
    line(context, x, trackBottom + 3, x, trackBottom + 7);
    label(context, signed(db, 0), x, trackBottom + 16, 'center', inks.text);
  }

  // The voice's body, the scale's zero.
  const voiceX = xOf(0);
  context.strokeStyle = `rgba(${inks.voice},0.9)`;
  context.lineWidth = 2;
  line(context, voiceX, trackTop - 10, voiceX, trackBottom);
  context.lineWidth = 1;
  const voiceInk = `rgba(${inks.voice},1)`;
  label(context, labels.voice, voiceX, trackTop - 18, 'center', voiceInk);

  // Where it starts: the line the dial moves.
  glow(context, '255,255,255', 8);
  context.strokeStyle = POINT_INK;
  context.lineWidth = 2;
  line(context, at, trackTop - 6, at, trackBottom + 6);
  context.lineWidth = 1;
  noGlow(context);
  context.font = POINT_FONT;
  label(
    context,
    `${labels.threshold} · ${labels.underVoice(distanceDb(threshold))}`,
    Math.min(Math.max(at, left + 90), left + width - 90),
    box.y + box.height - 10,
    'center',
    POINT_INK,
  );
  context.font = GRAPH_FONT;

  // The treble now, if anything is playing.
  if (Number.isFinite(sibilanceDb)) {
    const x = xOf(sibilanceDb);
    const ink = sibilanceDb > threshold ? inks.cut : inks.voice;
    glow(context, ink, 10);
    context.fillStyle = `rgba(${ink},1)`;
    context.beginPath();
    context.moveTo(x, trackTop - 2);
    context.lineTo(x - 6, trackTop - 11);
    context.lineTo(x + 6, trackTop - 11);
    context.closePath();
    context.fill();
    context.fillRect(x - 1, trackTop, 2, trackH);
    noGlow(context);
    if (Math.abs(x - voiceX) > 70) {
      // Kept inside the picture at either end of the scale.
      const textX = Math.min(Math.max(x, left + 40), left + width - 40);
      const ink2 = `rgba(${ink},1)`;
      label(context, labels.trebleNow, textX, trackTop - 18, 'center', ink2);
    }
  }
};

/** The voice's body, sketched under a wide axis so a whole-sound cut is seen taking it. */
const drawVoiceBody = (
  { context, inks, labels }: ILensPicture,
  xOf: (hz: number) => number,
  top: number,
  bottom: number,
) => {
  const hump = context.createLinearGradient(0, top, 0, bottom);
  hump.addColorStop(0, `rgba(${inks.voice},0.0)`);
  hump.addColorStop(1, `rgba(${inks.voice},0.22)`);
  context.fillStyle = hump;
  context.beginPath();
  context.moveTo(xOf(120), bottom);
  const crest = top + (bottom - top) * 0.25;
  context.bezierCurveTo(xOf(250), crest, xOf(1600), crest, xOf(4500), bottom);
  context.closePath();
  context.fill();
  const ink = `rgba(${inks.voice},0.95)`;
  label(context, labels.voice, xOf(600), bottom - 10, 'center', ink);
};

/**
 * Up to and Width: the cut one S gets, across the treble, on the dial's own
 * scale (0 to its deepest) so turning Up to moves the floor and turning
 * Width moves the skirts. A way of cutting being pointed at draws the same
 * S on an axis from 20 Hz, so Whole voice is seen taking the voice too.
 */
export const drawShape = (
  picture: ILensPicture,
  mode: TDeEsserMode,
  emphasis: 'depth' | 'width',
  wide: boolean,
) => {
  const { context, box, settings, inks, labels } = picture;
  const low = wide ? WIDE_LOW_HZ : LOW_HZ;
  const top = box.y + 18;
  const bottom = box.y + box.height - 20;
  const scaleDb = DE_ESSER_RANGES.rangeDb.max;
  const yOf = (db: number) =>
    top + (Math.min(scaleDb, -db) / scaleDb) * (bottom - top);
  const plot = { ...box, x: box.x + 30, width: box.width - 38 };
  const xOf = (hz: number) => xOfHz(plot, hz, low, HIGH_HZ);
  const sHz = Math.sqrt(settings.lowHz * settings.highHz);
  const shape = sCut(settings, sHz);

  // dB down the left, kHz under.
  context.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let db = 0; db <= scaleDb; db += 6) {
    const y = Math.round(yOf(-db)) + 0.5;
    line(context, plot.x, y, plot.x + plot.width, y);
    label(context, signed(-db, 0), plot.x - 6, y, 'right', inks.text);
  }
  const grid = wide ? [100, 1000, 10000] : [3000, 5000, 10000, 15000];
  grid.forEach((hz) => {
    const x = Math.round(xOf(hz)) + 0.5;
    line(context, x, top, x, bottom);
    const name = hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
    label(context, name, x, bottom + 12, 'center', inks.text);
  });

  // The listening range, and the voice under it when the axis reaches it.
  const from = xOf(settings.lowHz);
  context.fillStyle = `rgba(${inks.voice},0.07)`;
  context.fillRect(from, top, xOf(settings.highHz) - from, bottom - top);
  if (wide) {
    drawVoiceBody(picture, xOf, top, bottom);
  }

  // The cut itself.
  const steps = Math.max(48, Math.round(plot.width / 3));
  const trace = () => {
    context.beginPath();
    for (let step = 0; step <= steps; step += 1) {
      const hz = low * (HIGH_HZ / low) ** (step / steps);
      const y = yOf(Math.min(0, cutAt(hz, shape, mode, settings.lowHz)));
      if (step === 0) {
        context.moveTo(xOf(hz), y);
      } else {
        context.lineTo(xOf(hz), y);
      }
    }
  };
  trace();
  context.lineTo(plot.x + plot.width, top);
  context.lineTo(plot.x, top);
  context.closePath();
  const fill = context.createLinearGradient(0, top, 0, yOf(-settings.rangeDb));
  fill.addColorStop(0, `rgba(${inks.cut},0.08)`);
  fill.addColorStop(1, `rgba(${inks.cut},0.42)`);
  context.fillStyle = fill;
  context.fill();
  glow(context, inks.cut, 10);
  trace();
  context.strokeStyle = `rgba(${inks.cut},1)`;
  context.lineWidth = 2;
  context.stroke();
  context.lineWidth = 1;
  noGlow(context);

  // The S it was asked for.
  if (mode !== 'whole') {
    const x = xOf(sHz);
    context.strokeStyle = `rgba(${inks.voice},0.8)`;
    line(context, x, top, x, bottom);
    label(context, labels.s, x + 5, top + 8, 'left', `rgba(${inks.voice},1)`);
  }

  context.font = POINT_FONT;
  if (emphasis === 'depth') {
    const y = Math.round(yOf(-settings.rangeDb)) + 0.5;
    context.setLineDash([4, 4]);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    line(context, plot.x, y, plot.x + plot.width, y);
    context.setLineDash([]);
    label(
      context,
      labels.upTo(`${signed(-settings.rangeDb, 1)} dB`),
      plot.x + plot.width - 4,
      Math.min(bottom - 8, y + 12),
      'right',
      POINT_INK,
    );
  } else {
    // Where a neighbour gets half the S's cut: half the width either side.
    const half = settings.widthOct / 2;
    const x0 = xOf(sHz / 2 ** half);
    const x1 = xOf(sHz * 2 ** half);
    const y = Math.round(yOf(-settings.rangeDb / 2)) + 0.5;
    glow(context, '255,255,255', 6);
    context.strokeStyle = POINT_INK;
    context.lineWidth = 1.5;
    line(context, x0, y, x1, y);
    line(context, x0, y - 5, x0, y + 5);
    line(context, x1, y - 5, x1, y + 5);
    context.lineWidth = 1;
    noGlow(context);
    const width = `${settings.widthOct.toFixed(2)} oct`;
    label(context, width, (x0 + x1) / 2, y + 14, 'center', POINT_INK);
  }
  context.font = GRAPH_FONT;
};
