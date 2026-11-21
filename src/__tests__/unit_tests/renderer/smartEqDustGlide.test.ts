/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { smartEqResponse } from 'common/smartEqContinuous';
import {
  CURVE_EASE_HELD_S,
  curveEaseShare,
} from 'renderer/graph/smartEqDustDraw';
import { SMART_EQ_LAYOUT } from 'renderer/utils/smartEqSolve';

/**
 * The forming curve glides over a checkpoint's step instead of jolting.
 *
 * The two solved curves below are consecutive checkpoints of a real song,
 * half a second apart (2026-11-21): 2.5 dB at the top of the spectrum, where
 * the air range was still uncertain. The control draws them at the old pace
 * (0.22 s), which jumps most of the way within a tenth of a second.
 */

const gainsOf = (text: string) =>
  Object.fromEntries(
    text.split(' ').map((pair) => {
      const [band, gain] = pair.split(':');
      return [`smart-${band}`, Number(gain)];
    }),
  );

const before = smartEqResponse(
  SMART_EQ_LAYOUT,
  gainsOf(
    '40:3.0 50:2.5 63:1.8 80:0.8 100:-0.2 125:-0.7 160:-0.6 200:-0.3 250:-0.5 315:-0.7 400:-0.6 500:-0.3 630:-0.4 800:-0.4 1000:-0.3 1250:0.0 1600:-0.1 2000:-0.5 2500:-0.3 3150:0.7 4000:1.8 5000:0.6 6300:0.6 8000:-0.6 10000:-1.5 12500:-1.2',
  ),
);
const after = smartEqResponse(
  SMART_EQ_LAYOUT,
  gainsOf(
    '40:2.9 50:2.5 63:1.7 80:0.9 100:0.0 125:-0.5 160:-0.3 200:-0.1 250:-0.2 315:-0.5 400:-0.3 500:-0.1 630:-0.2 800:-0.2 1000:-0.1 1250:0.2 1600:0.2 2000:-0.3 2500:-0.5 3150:0.6 4000:1.6 5000:0.7 6300:0.7 8000:-0.9 10000:-2.4 12500:-2.9',
  ),
);

const FRAME_S = 1 / 60;

/**
 * Draws the step frame by frame with `share` and returns the widest move of
 * the drawn curve within any tenth of a second, and how far it still is from
 * the new curve after `seconds`.
 */
const draw = (share: (dt: number) => number, seconds: number) => {
  const drawn = [...before];
  const history: number[][] = [[...drawn]];
  for (let frame = 0; frame < Math.round(seconds / FRAME_S); frame += 1) {
    const amount = share(FRAME_S);
    drawn.forEach((level, point) => {
      drawn[point] = level + (after[point] - level) * amount;
    });
    history.push([...drawn]);
  }
  const window = Math.round(0.1 / FRAME_S);
  const widestMove = history
    .slice(window)
    .reduce(
      (widest, levels, offset) =>
        levels.reduce(
          (inner, level, point) =>
            Math.max(inner, Math.abs(level - history[offset][point])),
          widest,
        ),
      0,
    );
  const remaining = drawn.reduce(
    (widest, level, point) => Math.max(widest, Math.abs(after[point] - level)),
    0,
  );
  return { widestMove, remaining };
};

const step = before.reduce(
  (widest, level, point) => Math.max(widest, Math.abs(after[point] - level)),
  0,
);

it('is a real step of more than two decibels', () => {
  expect(step).toBeGreaterThan(2);
});

it('glides over it while forming', () => {
  const { widestMove, remaining } = draw((dt) => curveEaseShare(dt, false), 4);
  expect(widestMove).toBeLessThan(0.35);
  expect(remaining).toBeLessThan(0.1);
});

it('jolted at the old pace (control)', () => {
  const { widestMove } = draw((dt) => 1 - Math.exp(-dt / 0.22), 4);
  expect(widestMove).toBeGreaterThan(0.8);
});

it('is in place within the hold sweep once held', () => {
  const { remaining } = draw((dt) => curveEaseShare(dt, true), 0.6);
  expect(CURVE_EASE_HELD_S).toBeLessThan(0.2);
  expect(remaining).toBeLessThan(0.1);
});
