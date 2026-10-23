/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GRAPH_FONT } from './deEsserPlot';
import {
  glow,
  ILensPicture,
  label,
  line,
  LOOK_AHEAD_MS,
  niceStep,
  noGlow,
  POINT_FONT,
  POINT_INK,
} from './deEsserLensKit';

/** How long the drawn S holds, and its edges: a 15 ms rise, a 30 ms fall. */
const S_LENGTH_MS = 100;
const S_RISE_MS = 15;
const S_FALL_MS = 30;

/** An S's level over time, as the engine's test scene shapes one. */
const sEnvelope = (ms: number) => {
  if (ms < 0 || ms > S_LENGTH_MS + S_FALL_MS) {
    return 0;
  }
  if (ms < S_RISE_MS) {
    return 0.5 - 0.5 * Math.cos((Math.PI * ms) / S_RISE_MS);
  }
  return ms <= S_LENGTH_MS
    ? 1
    : 0.5 + 0.5 * Math.cos((Math.PI * (ms - S_LENGTH_MS)) / S_FALL_MS);
};

interface IPane {
  kind: 'attack' | 'release';
  x: number;
  width: number;
  fromMs: number;
  toMs: number;
}

/** How far the cut has gone, 0 to 1, at `ms` into the pane's moment. */
const cutShare = (
  pane: IPane,
  attackMs: number,
  releaseMs: number,
  ms: number,
) => {
  if (pane.kind === 'attack') {
    // One pole toward the full depth, from the moment the look-ahead hears it.
    const since = ms + LOOK_AHEAD_MS;
    return since <= 0 ? 0 : 1 - Math.exp(-since / attackMs);
  }
  return ms <= 0 ? 1 : Math.exp(-ms / releaseMs);
};

const drawPane = (
  { context, box, settings, inks, labels }: ILensPicture,
  pane: IPane,
  lit: boolean,
) => {
  const top = box.y + 22;
  const bottom = box.y + box.height - 20;
  const cutBottom = top + (bottom - top) * 0.42;
  const xOf = (ms: number) =>
    pane.x + ((ms - pane.fromMs) / (pane.toMs - pane.fromMs)) * pane.width;
  const steps = Math.max(60, Math.round(pane.width / 2));
  const msAt = (step: number) =>
    pane.fromMs + ((pane.toMs - pane.fromMs) * step) / steps;

  context.save();
  context.globalAlpha *= lit ? 1 : 0.38;
  const isAttack = pane.kind === 'attack';
  const name = isAttack ? labels.attack : labels.release;
  const value = isAttack ? settings.attackMs : settings.releaseMs;
  context.font = POINT_FONT;
  const title = `${name} · ${value.toFixed(isAttack ? 1 : 0)} ms`;
  label(context, title, pane.x, box.y + 8, 'left', POINT_INK);
  context.font = GRAPH_FONT;
  context.strokeStyle = 'rgba(255,255,255,0.08)';
  [top, bottom].forEach((y) => {
    const at = Math.round(y) + 0.5;
    line(context, pane.x, at, pane.x + pane.width, at);
  });

  // The S, from the bottom: it starts at 0 in Catch the start's pane and ends
  // at 0 in Let go's.
  const offset = isAttack ? 0 : -S_LENGTH_MS;
  context.beginPath();
  context.moveTo(xOf(pane.fromMs), bottom);
  for (let step = 0; step <= steps; step += 1) {
    const level = sEnvelope(msAt(step) - offset);
    context.lineTo(xOf(msAt(step)), bottom - level * (bottom - cutBottom - 12));
  }
  context.lineTo(xOf(pane.toMs), bottom);
  context.closePath();
  context.fillStyle = `rgba(${inks.voice},0.35)`;
  context.fill();
  const sX = xOf(isAttack ? 12 : -10);
  label(context, labels.s, sX, bottom - 10, 'center', `rgba(${inks.voice},1)`);

  // The cut, hanging from the top.
  const trace = () => {
    context.beginPath();
    for (let step = 0; step <= steps; step += 1) {
      const share = cutShare(
        pane,
        settings.attackMs,
        settings.releaseMs,
        msAt(step),
      );
      const y = top + share * (cutBottom - top);
      if (step === 0) {
        context.moveTo(xOf(msAt(step)), y);
      } else {
        context.lineTo(xOf(msAt(step)), y);
      }
    }
  };
  trace();
  context.lineTo(xOf(pane.toMs), top);
  context.lineTo(xOf(pane.fromMs), top);
  context.closePath();
  context.fillStyle = `rgba(${inks.cut},0.28)`;
  context.fill();
  if (lit) {
    glow(context, inks.cut, 10);
  }
  trace();
  context.strokeStyle = `rgba(${inks.cut},1)`;
  context.lineWidth = 2;
  context.stroke();
  context.lineWidth = 1;
  noGlow(context);

  // The moment that matters on each: where the S arrives and how far ahead
  // the stage heard it; the time constant after it ends.
  context.setLineDash([3, 3]);
  context.strokeStyle = 'rgba(255,255,255,0.4)';
  const zero = Math.round(xOf(0)) + 0.5;
  line(context, zero, top, zero, bottom);
  const marker =
    Math.round(xOf(isAttack ? -LOOK_AHEAD_MS : settings.releaseMs)) + 0.5;
  line(context, marker, top, marker, cutBottom + 10);
  context.setLineDash([]);
  if (isAttack) {
    // After the marker, where the S has barely begun: before it there is
    // only the pane's edge.
    const ahead = labels.ahead(`${LOOK_AHEAD_MS} ms`);
    label(context, ahead, marker + 5, cutBottom + 18, 'left', inks.text);
  }

  // Milliseconds under the pane, the unit after the last figure.
  const tick = niceStep(pane.toMs);
  for (let ms = 0; ms + tick <= pane.toMs; ms += tick) {
    label(context, `${ms}`, xOf(ms), bottom + 12, 'center', inks.text);
  }
  label(context, 'ms', pane.x + pane.width, bottom + 12, 'right', inks.text);
  context.restore();
};

/**
 * Catch the start and Let go: the S, and the cut following it as the engine
 * moves it — one pole each way, the cut already moving the look-ahead before
 * the S arrives. Two panes on their own time scales, because a millisecond's
 * attack and a half-second's release share no axis anyone could read; the
 * dial in hand lights its own.
 */
const drawTiming = (picture: ILensPicture, emphasis: 'attack' | 'release') => {
  const { box, settings } = picture;
  const gap = 18;
  const width = (box.width - gap) / 2;
  drawPane(
    picture,
    {
      kind: 'attack',
      x: box.x,
      width,
      fromMs: -6,
      toMs: Math.max(24, settings.attackMs * 5 + 4),
    },
    emphasis === 'attack',
  );
  drawPane(
    picture,
    {
      kind: 'release',
      x: box.x + width + gap,
      width,
      fromMs: -20,
      toMs: Math.max(120, settings.releaseMs * 5),
    },
    emphasis === 'release',
  );
};

export default drawTiming;
