/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rule that stops a scene too heavy for this GPU from holding it long
 * enough for Windows to reset the display. Played with a pretend clock: each
 * draw takes as long as the scene's cost per pixel says it does.
 */

import {
  BLAMED_FRAME_MS,
  createDrawWatch,
  FAR_PAST,
  FIRST_DRAW_MS,
  READBACK_MS,
} from '../../../renderer/graph/sceneDrawWatch';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';

const frame = { deltaMs: 16, timeSeconds: 1 } as unknown as ISceneFrame;
const MS_PER_PIXEL = 0.01;

const watchOver = (
  msPerPixelDrawn: (width: number, height: number, draw: number) => number,
  ladder: readonly (readonly [number, number])[] = [[16, 9]],
) => {
  let clock = 0;
  let lost = false;
  const draws: { width: number; height: number; deltaMs?: number }[] = [];
  const watch = createDrawWatch({
    draw: (drawn, width, height) => {
      draws.push({ width, height, deltaMs: drawn.deltaMs });
      clock += width * height * msPerPixelDrawn(width, height, draws.length);
    },
    finish: () => {
      clock += 1;
    },
    isLost: () => lost,
    now: () => clock,
    msPerPixel: MS_PER_PIXEL,
    ladder,
  });
  return {
    watch,
    draws,
    loseContext: () => {
      lost = true;
    },
  };
};

it('lets a scene that keeps within its pixels draw every frame', () => {
  const { watch, draws } = watchOver(() => MS_PER_PIXEL / 2);
  for (let step = 0; step < 180; step += 1) {
    expect(watch(frame, 64, 36)).toBe(true);
  }
  // One ladder step, drawn at the frame's instant without moving its clock.
  expect(draws[0]).toEqual({ width: 16, height: 9, deltaMs: 0 });
  expect(draws).toHaveLength(181);
});

it('gives a scene up on its tiny first draw, before anything larger reaches the GPU', () => {
  // So heavy even sixteen by nine takes longer than the driver's warm-up.
  const { watch, draws } = watchOver(() => (FIRST_DRAW_MS + 1) / 144);
  expect(watch(frame, 768, 432)).toBe(false);
  // Drawn once more before it counts, since a first draw carries warm-up.
  expect(draws).toEqual([
    { width: 16, height: 9, deltaMs: 0 },
    { width: 16, height: 9, deltaMs: 0 },
  ]);
  // And stays given up without drawing again.
  expect(watch(frame, 768, 432)).toBe(false);
  expect(draws).toHaveLength(2);
});

it('climbs the ladder and stops at the first step that is far too slow', () => {
  const ladder = [
    [16, 9],
    [96, 54],
    [384, 216],
  ] as const;
  // Fine while the read dominates, far too slow once the pixels do.
  const { watch, draws } = watchOver(
    (width) => (width >= 384 ? MS_PER_PIXEL * FAR_PAST * 2 : 0),
    ladder,
  );
  expect(watch(frame, 768, 432)).toBe(false);
  expect(draws.map((draw) => draw.width)).toEqual([16, 96, 384, 384]);
});

it('forgives one late frame, not two in a row, and not one far past its allowance', () => {
  const allowed = (width: number, height: number) =>
    width * height * MS_PER_PIXEL + READBACK_MS;
  const late = (allowed(64, 36) * 1.5 - 1) / (64 * 36);
  const pattern = [0, 0, late, 0, late, late];
  const { watch } = watchOver((width, height, draw) =>
    width === 16 && height === 9 ? 0 : (pattern[draw - 2] ?? 0),
  );
  expect(pattern.map(() => watch(frame, 64, 36))).toEqual([
    true,
    true,
    true,
    true,
    true,
    false,
  ]);

  const far = (allowed(64, 36) * FAR_PAST + 1) / (64 * 36);
  const once = watchOver((width) => (width === 16 ? 0 : far));
  // The first frame at a size carries its warm-up: late, not the end.
  expect(once.watch(frame, 64, 36)).toBe(true);
  expect(once.watch(frame, 64, 36)).toBe(false);
});

it('gives a scene up the moment the GPU drops its context', () => {
  const { watch, loseContext } = watchOver(() => 0);
  expect(watch(frame, 64, 36)).toBe(true);
  loseContext();
  expect(watch(frame, 64, 36)).toBe(false);
});

it('draws the real frame through the caller’s own drawing when it has one', () => {
  const { watch, draws } = watchOver(() => 0);
  const own = jest.fn();
  expect(watch(frame, 768, 432, own)).toBe(true);
  expect(own).toHaveBeenCalledTimes(1);
  // Only the ladder went through the plain draw.
  expect(draws).toEqual([{ width: 16, height: 9, deltaMs: 0 }]);
});

it('forgives a warm-up at a ladder step, and the first frame at a size, but not a scene slow every time', () => {
  const ladder = [
    [16, 9],
    [32, 18],
  ] as const;
  const allowed = (width: number, height: number) =>
    width * height * MS_PER_PIXEL + READBACK_MS;
  const past = (width: number, height: number) =>
    (allowed(width, height) * FAR_PAST + 1) / (width * height);
  // Alpine on the lamps: its first draw at each size four times its limit,
  // then light.
  const seen = new Set<string>();
  const warm = watchOver((width, height) => {
    const size = `${width}x${height}`;
    const first = !seen.has(size);
    seen.add(size);
    return first && width > 16 ? past(width, height) : 0;
  }, ladder);
  expect(warm.watch(frame, 64, 36)).toBe(true);
  expect(warm.watch(frame, 64, 36)).toBe(true);
  expect(warm.draws.map((draw) => draw.width)).toEqual([16, 32, 32, 64, 64]);

  // The control: as slow on the second draw, it is given up there.
  const heavy = watchOver(
    (width, height) => (width > 16 ? past(width, height) : 0),
    ladder,
  );
  expect(heavy.watch(frame, 64, 36)).toBe(false);
  expect(heavy.draws.map((draw) => draw.width)).toEqual([16, 32, 32]);
});

it('gives the first frame at a size up when it held the GPU like a scene that resets it', () => {
  const { watch } = watchOver((width) =>
    width === 16 ? 0 : (BLAMED_FRAME_MS + 1) / (64 * 36),
  );
  expect(watch(frame, 64, 36)).toBe(false);
});
