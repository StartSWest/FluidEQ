/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { sceneSizingFixture } from 'renderer/graph/sceneSizingFixture';

/**
 * The desktop backgrounds drawn by C++ choose their size, their pace and
 * their finishing through twins of `sceneHealth.ts`, `sceneWarmup.ts`,
 * `frameCadence.ts`, `framePace.ts`, `sceneRest.ts` and `sceneDrawSizes.ts`,
 * held by `scene_sizing_parity_test.cpp` to `scene_sizing_fixture.h`. A
 * change to any of those, not regenerated there, is a C++ test held to rules
 * the window no longer follows — so this holds the header to the modules
 * byte for byte.
 */
const header = readFileSync(
  path.resolve(process.cwd(), 'native/scene-core/tests/scene_sizing_fixture.h'),
  'utf8',
);

it('is what the window sizes and paces its scenes by now', () => {
  expect(header).toBe(sceneSizingFixture());
});

const rowsOf = (name: string) => {
  const start = header.indexOf(`${name}[][`);
  const body = header.slice(start, header.indexOf('};', start));
  return [...body.matchAll(/^ {4}\{([^}]*)\}/gm)].map((match) =>
    match[1].split(', ').map(Number),
  );
};

/**
 * The inputs have to drive every branch, or the C++ is held to a branch
 * neither side took: each ladder stepping both ways, the slow rung, a scene
 * handed over, finishing given up, and each action taken.
 */
it('drives every way a ladder can go', () => {
  const runs = rowsOf('kLadderRuns');
  const frames = rowsOf('kLadderFrames');
  const framesOf = ([, , , first, count]: number[]) =>
    frames.slice(first, first + count);
  const kinds = [0, 1].map((warmup) =>
    runs.filter((run) => run[0] === warmup).flatMap(framesOf),
  );
  kinds.forEach((kindFrames) => {
    const scales = kindFrames.map((frame) => frame[7]);
    expect(scales.some((scale, at) => at > 0 && scale < scales[at - 1])).toBe(
      true,
    );
    expect(scales.some((scale, at) => at > 0 && scale > scales[at - 1])).toBe(
      true,
    );
    expect(kindFrames.some((frame) => frame[8] === 1)).toBe(true);
    expect(kindFrames.some((frame) => frame[9] === 1)).toBe(true);
    expect(kindFrames.some((frame) => frame[0] < 0)).toBe(true);
    expect(new Set(kindFrames.map((frame) => frame[5]))).toEqual(
      new Set([0, 1, 2, 3]),
    );
    expect(scales.some((scale) => scale > 1)).toBe(true);
  });
  expect(frames.some((frame) => frame[10] === 1)).toBe(true);
});

it('drives every pass and every pacing answer', () => {
  const passes = new Set(
    rowsOf('kDrawPlans').flatMap((row) => [row[17], row[18]]),
  );
  expect(passes).toEqual(new Set([-1, 0, 1, 2, 3]));
  const due = rowsOf('kFrameDue').map((row) => row[3]);
  expect(new Set(due)).toEqual(new Set([0, 1]));
  const rest = rowsOf('kRest').map((row) => row[2]);
  expect(new Set(rest)).toEqual(new Set([0, 1]));
  const silence = rowsOf('kSilence').map((row) => row[8]);
  expect(new Set(silence)).toEqual(new Set([0, 1]));
});
