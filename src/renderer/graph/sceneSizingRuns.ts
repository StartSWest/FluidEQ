/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The runs the size ladders are driven through for the C++ fixture
 * (`sceneSizingFixture.ts`): each a scene's cost over its frames at the size
 * the ladder chose, picked so that every way a ladder can go is taken.
 */

export const SIXTY_MS = 1000 / 60;
export const ONE_TWENTY_MS = 1000 / 120;
export const ONE_FORTY_FOUR_MS = 1000 / 144;

export type TAction =
  | { at: number; kind: 'refloor' | 'resume'; value: number }
  | {
      at: number;
      kind: 'reset';
    };

export interface ILadderRun {
  warmup: boolean;
  top: number;
  floor: number;
  frames: number;
  /** The interval frames arrive at, before the slow rung halves it. */
  intervalMs: number;
  /** A GPU timer, or only fences. */
  clock: boolean;
  /** What a frame costs at full size, by frame. */
  costAt: (frame: number) => number;
  /** The finishing passes' cost, by frame; none where they are not timed. */
  postAt?: (frame: number) => number | undefined;
  hiddenAt?: (frame: number) => boolean;
  actions?: TAction[];
  /** How far a frame's cost strays either way: 15 % unless said. */
  noise?: number;
}

const phases =
  (...steps: [until: number, cost: number][]) =>
  (frame: number) =>
    (steps.find(([until]) => frame < until) ?? steps[steps.length - 1])[1];

export const LADDER_RUNS: ILadderRun[] = [
  {
    // Heavy, then light, then on the boundary, then hopeless: down, up, a
    // bounce, the slow rung, and handed over at the bottom. A clock, and the
    // finishing passes too dear for a while.
    warmup: false,
    top: 1,
    floor: 0.35,
    frames: 900,
    intervalMs: ONE_TWENTY_MS,
    clock: true,
    costAt: phases([100, 30], [400, 3], [650, 9], [900, 1500]),
    // Over the finishing share, by less than a twentieth of the interval.
    postAt: (frame) => (frame >= 200 && frame < 212 ? 2.7 : 0.4),
    hiddenAt: (frame) => frame >= 50 && frame < 56,
  },
  {
    // No timer queries: judged on the frames still on the GPU alone.
    warmup: false,
    top: 1,
    floor: 0.5,
    frames: 400,
    intervalMs: SIXTY_MS,
    clock: false,
    costAt: phases([120, 40], [400, 6]),
  },
  {
    // `best` smoothing's larger top, a floor moved, a size resumed, a reset.
    warmup: false,
    top: 1.7,
    floor: 0.5,
    frames: 500,
    intervalMs: ONE_FORTY_FOUR_MS,
    clock: true,
    costAt: phases([200, 4], [500, 12]),
    actions: [
      { at: 150, kind: 'refloor', value: 0.67 },
      { at: 300, kind: 'resume', value: 0.85 },
      { at: 400, kind: 'reset' },
    ],
  },
  {
    // A member's scene: up from the floor, down from a rung it ran slow at,
    // and hopeless at the floor.
    warmup: true,
    top: 1,
    floor: 0.35,
    frames: 500,
    intervalMs: SIXTY_MS,
    clock: true,
    costAt: phases([200, 6], [350, 70], [500, 5000]),
    postAt: () => 0.2,
    hiddenAt: (frame) => frame >= 20 && frame < 24,
  },
  {
    // Without a clock, `best` smoothing's top, a floor moved and resumed.
    warmup: true,
    top: 2,
    floor: 0.5,
    frames: 400,
    intervalMs: ONE_TWENTY_MS,
    clock: false,
    costAt: phases([250, 3], [400, 40]),
    actions: [
      { at: 100, kind: 'refloor', value: 0.67 },
      { at: 200, kind: 'resume', value: 1 },
      { at: 300, kind: 'reset' },
    ],
  },
  {
    // On the boundary of the budget: lone late frames and late pairs, which
    // a climb's run of clean frames survives and does not.
    warmup: false,
    top: 1,
    floor: 0.35,
    frames: 400,
    intervalMs: SIXTY_MS,
    clock: true,
    costAt: () => 15,
  },
  {
    // Heavy enough for the slow rung at once, and a floor moved under it
    // there: it stays slow.
    warmup: false,
    top: 1,
    floor: 0.35,
    frames: 200,
    intervalMs: ONE_TWENTY_MS,
    clock: true,
    costAt: () => 300,
    actions: [{ at: 120, kind: 'refloor', value: 0.5 }],
  },
  {
    // Light, but two frames in a row late every so often: a climb's run of
    // clean frames survives one late frame and not a pair.
    warmup: false,
    top: 1,
    floor: 0.35,
    frames: 400,
    intervalMs: SIXTY_MS,
    clock: true,
    costAt: (frame) => {
      if (frame < 60) {
        return 40;
      }
      return frame % 37 < 2 ? 80 : 5;
    },
  },
  {
    // A member's scene a hair over smooth one rung below full size, steady:
    // whether it climbs is exactly how much jitter counts as smooth.
    warmup: true,
    top: 1,
    floor: 0.35,
    frames: 300,
    intervalMs: SIXTY_MS,
    clock: true,
    costAt: () => 21.25 / (0.85 * 0.85),
    noise: 0.005,
  },
  {
    // Smooth at an eighth, slow at a quarter: barred from the quarter once
    // it ran slow there, and resumed under that bar.
    warmup: true,
    top: 1,
    floor: 0,
    frames: 300,
    intervalMs: SIXTY_MS,
    clock: true,
    costAt: () => 1000,
    actions: [{ at: 250, kind: 'resume', value: 1 }],
  },
  {
    // Slow at the smallest size allowed: the rate goes before the picture.
    warmup: true,
    top: 1,
    floor: 0.5,
    frames: 200,
    intervalMs: ONE_TWENTY_MS,
    clock: true,
    costAt: () => 120,
  },
];
