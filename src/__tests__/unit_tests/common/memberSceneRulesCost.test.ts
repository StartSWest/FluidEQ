/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the rules cost to APPLY, on sources written to make them expensive.
 *
 * The rules decide what a stranger's scene may do on somebody's GPU, and they
 * run in the main process on every read of an installed scene — listing the
 * looks checks every one of them — and on every save inside the open Studio
 * project. So a source that is merely slow to JUDGE is an attack on its own:
 * it needs to break no rule, it signs and publishes like any other scene, and
 * what the victim sees is an app that stops answering.
 *
 * Two shapes did exactly that, and both are pinned here with the input that
 * found them. The times are generous — this runs on whatever a build machine
 * is — but the defects were 1.8 s and 23 s, two and three orders of magnitude
 * away from the bound, so a regression cannot slip under it.
 */

import { checkMemberSceneSource } from '../../../common/memberSceneRules';

const ENTRY = 'vec4 sceneColour(vec2 uv) { return vec4(0.0); }\n';

const msToCheck = (source: string) => {
  const started = performance.now();
  const problems = checkMemberSceneSource(source);
  return { ms: performance.now() - started, problems };
};

/** Generous for a build machine; the defect it guards was 1832 ms. */
const BUDGET_MS = 400;

// The positive control. Without it, every case below would pass on a checker
// that returned an empty verdict without reading anything.
it('reads an ordinary scene quickly, and still reads it', () => {
  const source = `${ENTRY}${'float pad = 1.0;\n'.repeat(2000)}`;
  const { ms, problems } = msToCheck(source);
  expect(problems).toEqual([]);
  expect(ms).toBeLessThan(BUDGET_MS);
  expect(checkMemberSceneSource('float x = 1.0;')).toEqual([
    { code: 'entry-point', line: 1 },
  ]);
});

/**
 * Calls inside calls. The old scan sliced each parenthesised list out and
 * searched it for `out`/`inout` once per identifier around it, so nesting
 * made it quadratic: 87,000 deep took 1.8 seconds, broke no rule, and would
 * have been signed and published.
 */
it('judges deeply nested calls in linear time', () => {
  const depth = 20_000;
  const source = `${ENTRY}float z = ${'a('.repeat(depth)}1.0${')'.repeat(depth)};\n`;
  const { ms } = msToCheck(source);
  expect(ms).toBeLessThan(BUDGET_MS);
});

/**
 * A loop header followed by a long run of spaces. The step used to be matched
 * by a lazy group before optional whitespace, which backtracks once per
 * space: a quarter of a million of them took twenty-three seconds. This one
 * is refused either way — the point is how long refusing takes.
 */
it('refuses a padded loop header quickly', () => {
  const source = `${ENTRY}void pad() { for (int i = 0; i < 4; i++${' '.repeat(120_000)}x) { } }\n`;
  const { ms, problems } = msToCheck(source);
  expect(problems.map((problem) => problem.code)).toContain('loop-shape');
  expect(ms).toBeLessThan(BUDGET_MS);
});

// The same shape with a real step, so the header pattern is pinned as still
// reading one that is only padded rather than malformed.
it('still reads a loop whose step is spaced out', () => {
  const source = `${ENTRY}void pad() { for (int i = 0; i < 4;   i++   ) { } }\n`;
  expect(msToCheck(source).problems).toEqual([]);
});
