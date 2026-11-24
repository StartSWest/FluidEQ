/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsBand } from '../../../common/dsp/dynamicsStage';
import dynamicsGainDb from '../../../renderer/dsp/dynamicsCurve';
import {
  dragOf,
  dragPoint,
  pointAt,
  pointsOf,
  stepPoint,
} from '../../../renderer/dsp/dynamicsPoints';

const lifting: IDynamicsBand = {
  upThresholdDb: -30,
  upRatio: 2,
  upMaxDb: 6,
  downThresholdDb: -18,
  downRatio: 2,
};
const neutral: IDynamicsBand = {
  upThresholdDb: -40,
  upRatio: 1,
  upMaxDb: 0,
  downThresholdDb: -20,
  downRatio: 1,
};

/** The fields a change touched, so each case names what it moved. */
const changed = (before: IDynamicsBand, after: IDynamicsBand | undefined) =>
  (Object.keys(before) as (keyof IDynamicsBand)[]).filter(
    (key) => after?.[key] !== before[key],
  );

describe('the points a band shows', () => {
  it('shows the lift start only while the band lifts, and the dashed pull otherwise', () => {
    expect(pointsOf(lifting)).toEqual([
      'liftStart',
      'lift',
      'holdStart',
      'holdEnd',
    ]);
    expect(pointsOf(neutral)).toEqual(['lift', 'holdStart', 'holdEnd']);
    expect(dragOf('lift', lifting)).toBe('liftTop');
    expect(dragOf('lift', neutral)).toBe('liftPull');
  });

  it('stands each point on the curve it sets', () => {
    expect(pointAt('liftStart', lifting)).toEqual({ inDb: -30, outDb: -30 });
    const top = pointAt('lift', lifting);
    expect(top).toEqual({ inDb: -42, outDb: -36 });
    expect(top.inDb + dynamicsGainDb(lifting, top.inDb)).toBeCloseTo(
      top.outDb,
      9,
    );
    expect(pointAt('lift', neutral)).toEqual({ inDb: -40, outDb: -40 });
    expect(pointAt('holdStart', lifting)).toEqual({ inDb: -18, outDb: -18 });
    expect(pointAt('holdEnd', lifting)).toEqual({ inDb: 0, outDb: -9 });
  });
});

describe('dragging a point', () => {
  it('moves Below sideways with the lift start, and nothing else', () => {
    const next = dragPoint('liftStart', lifting, -36.4, -10);
    expect(changed(lifting, next)).toEqual(['upThresholdDb']);
    expect(next.upThresholdDb).toBe(-36);
    expect(dragPoint('liftStart', lifting, -95, 0).upThresholdDb).toBe(-80);
    expect(dragPoint('liftStart', lifting, 5, 0).upThresholdDb).toBe(-10);
  });

  it('moves Above sideways with the hold start, and nothing else', () => {
    const next = dragPoint('holdStart', lifting, -24.6, 3);
    expect(changed(lifting, next)).toEqual(['downThresholdDb']);
    expect(next.downThresholdDb).toBe(-25);
    expect(dragPoint('holdStart', lifting, -70, 0).downThresholdDb).toBe(-60);
  });

  it('sets the hold ratio from where the end stands at 0 dBFS', () => {
    // Over -18, the end at -12 is 6 dB of 18: 3:1.
    const next = dragPoint('holdEnd', lifting, 0, -12);
    expect(changed(lifting, next)).toEqual(['downRatio']);
    expect(next.downRatio).toBe(3);
    expect(dragPoint('holdEnd', lifting, 0, 2).downRatio).toBe(1);
    expect(dragPoint('holdEnd', lifting, 0, -30).downRatio).toBe(20);
    // A hold that starts at 0 dBFS has no end to move.
    const top = { ...lifting, downThresholdDb: 0 };
    expect(dragPoint('holdEnd', top, 0, -6)).toBe(top);
  });

  it('keeps the lift top under the hand: Up to the height, the ratio the slope', () => {
    // A top at (-40, -34): 6 dB over the line, 10 dB left of Below at -30,
    // so the slope back to Below is 4 in 10 and the ratio 10 / 4.
    const next = dragPoint('liftTop', lifting, -40, -34);
    expect(changed(lifting, next).sort()).toEqual(['upRatio']);
    expect(next.upRatio).toBe(2.5);
    const higher = dragPoint('liftTop', lifting, -40, -31);
    expect(higher.upMaxDb).toBe(9);
    expect(higher.upRatio).toBe(4);
    expect(dragPoint('liftTop', lifting, -42, -20).upMaxDb).toBe(18);
    // Back down to the line it lifts nothing, and the slot turns to the pull.
    const flat = dragPoint('liftTop', lifting, -42, -42);
    expect(flat.upMaxDb).toBe(0);
    expect(pointsOf(flat)).toEqual(['lift', 'holdStart', 'holdEnd']);
  });

  it('slides the dashed pull along the line, and pulls a lift out above it', () => {
    const slid = dragPoint('liftPull', neutral, -33.2, -32.5);
    expect(changed(neutral, slid)).toEqual(['upThresholdDb']);
    expect(slid.upThresholdDb).toBe(-33);
    const pulled = dragPoint('liftPull', neutral, -50, -46);
    expect(pulled.upMaxDb).toBe(4);
    // 10 dB left of Below, 6 under it: 10 / 6.
    expect(pulled.upRatio).toBe(1.7);
    expect(pulled.upThresholdDb).toBe(-40);
  });
});

describe('the arrow keys', () => {
  it('step the threshold a point sits on, by 1 dB or 6 with Shift', () => {
    expect(
      stepPoint('liftStart', lifting, 'ArrowRight', false)?.upThresholdDb,
    ).toBe(-29);
    expect(
      stepPoint('liftStart', lifting, 'ArrowLeft', true)?.upThresholdDb,
    ).toBe(-36);
    expect(
      stepPoint('holdStart', lifting, 'ArrowDown', false)?.downThresholdDb,
    ).toBe(-19);
    expect(stepPoint('holdStart', lifting, 'End', false)?.downThresholdDb).toBe(
      0,
    );
    expect(
      changed(lifting, stepPoint('holdStart', lifting, 'ArrowUp', false)),
    ).toEqual(['downThresholdDb']);
  });

  it('move the hold end up for less hold and down for more', () => {
    expect(stepPoint('holdEnd', lifting, 'ArrowDown', false)?.downRatio).toBe(
      2.1,
    );
    expect(stepPoint('holdEnd', lifting, 'ArrowUp', false)?.downRatio).toBe(
      1.9,
    );
    expect(stepPoint('holdEnd', lifting, 'PageDown', false)?.downRatio).toBe(3);
    expect(stepPoint('holdEnd', lifting, 'Home', false)?.downRatio).toBe(1);
  });

  it('step Up to straight up and down on the lift top, and the ratio sideways', () => {
    const up = stepPoint('liftTop', lifting, 'ArrowUp', false);
    expect(up?.upMaxDb).toBe(6.5);
    // The top kept where it stood across.
    expect(pointAt('lift', up ?? lifting).inDb).toBeCloseTo(-42, 0);
    const right = stepPoint('liftTop', lifting, 'ArrowRight', false);
    expect(changed(lifting, right)).toEqual(['upRatio']);
    expect(right?.upRatio).toBe(2.1);
    const floor = { ...lifting, upRatio: 1.1 };
    expect(stepPoint('liftTop', floor, 'ArrowLeft', false)?.upRatio).toBe(1.1);
  });

  it('pull a gentle lift out of the dashed point, or move it along the line', () => {
    const pulled = stepPoint('liftPull', neutral, 'ArrowUp', false);
    expect(pulled?.upRatio).toBe(2);
    expect(pulled?.upMaxDb).toBe(1);
    expect(pointsOf(pulled ?? neutral)).toContain('liftStart');
    expect(
      stepPoint('liftPull', neutral, 'ArrowRight', false)?.upThresholdDb,
    ).toBe(-39);
    expect(stepPoint('liftPull', neutral, 'ArrowDown', false)).toBeUndefined();
  });
});
