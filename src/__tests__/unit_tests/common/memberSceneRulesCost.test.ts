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

/**
 * A backslash immediately before a newline, which the compiler splices away
 * BEFORE it reads comments.
 *
 * `*\` + newline + `/` therefore closes a block comment for the compiler
 * while the blanker is still looking for the first literal star-slash further
 * down — so the checker blanks out code the GPU is going to run, and every
 * rule in the file is reading a different program from the one that
 * executes. Anything at all can be hidden in the gap. Written from the
 * character code so this file carries no line continuation of its own.
 */
describe('a comment the compiler ends earlier than we do', () => {
  const BACKSLASH = String.fromCharCode(92);
  /**
   * EVERY line terminator, not just a line feed. GLSL ES ends a line at "a
   * carriage return or a line feed" and deletes a backslash before either, so
   * a lone carriage return splices exactly like a newline — and the guard
   * was written as a backslash before `\r?\n`, which a lone carriage return
   * is not. The same total bypass, through one byte, found the second time by
   * a reviewer who read the spec rather than the fix.
   */
  const ENDINGS: readonly [string, string][] = [
    ['a line feed', '\n'],
    ['a carriage return and a line feed', `${String.fromCharCode(13)}\n`],
    ['a bare carriage return', String.fromCharCode(13)],
  ];
  const hiding = (hidden: string, ending = '\n') =>
    `${ENTRY}void sneak() {\n  /*c*${BACKSLASH}${ending}/\n  ${hidden}\n  /**/\n}\n`;

  const HIDDEN: readonly [string, string][] = [
    [
      'a loop with no bound anyone counted',
      'for (int i = 0; i < 2000000000; i++) { }',
    ],
    ['a while', 'while (uTime >= 0.0) { }'],
    ['a preprocessor line', '#define REP 90000000'],
    ['another main', 'void main() { }'],
    [
      'a loop resetting its own counter',
      'for (int i = 0; i < 4; i++) { i = 0; }',
    ],
  ];

  describe.each(ENDINGS)('spliced with %s', (_ending, ending) => {
    it.each(HIDDEN)('refuses one hiding %s', (_name, hidden) => {
      expect(
        msToCheck(hiding(hidden, ending)).problems.map((p) => p.code),
      ).toContain('preprocessor');
    });
  });

  // The control: a backslash inside a comment that is NOT at a line end is an
  // ordinary Windows path, splices nothing, and stays allowed.
  it('still allows a path written in a comment', () => {
    const source = `${ENTRY}/* see C:${BACKSLASH}scenes${BACKSLASH}notes.txt */\n`;
    expect(msToCheck(source).problems).toEqual([]);
  });
});

/**
 * What the budget makes of a texture fetch.
 *
 * Every call used to weigh the same, so a `texture()` cost what a `+` costs —
 * a thirty-second of a unit — and a scene could pass the budget while holding
 * the GPU long enough to reset the driver. A fetch whose address comes from
 * the fetch before it waits on memory and cannot be hoisted, coalesced, or
 * run alongside its neighbours.
 */
describe('a scene that does nothing but fetch', () => {
  const fetching = (copies: number) =>
    `vec4 sceneColour(vec2 uv) {
  vec2 p = uv; vec4 s = vec4(0.0);
  for (int i = 0; i < 128; i++) {
${Array(copies)
  .fill('    p = texture(uArtwork, p + vec2(p.y, p.x)).rg; s.rg += p;')
  .join('\n')}
  }
  return s;
}
`;

  it('refuses the shape that used to be accepted whole', () => {
    // 369 lines by 128 turns: 47,232 dependent fetches for every pixel, and
    // about two hundred billion over a 1080p frame.
    expect(
      msToCheck(fetching(369)).problems.map((problem) => problem.code),
    ).toContain('loop-budget');
  });

  // The control, and the honest limit of this: a sixth of that size is still
  // accepted, because closing it costs a scene that already exists. See the
  // comment on COSTLY_CALLS.
  it('still takes a scene that fetches the way a real one does', () => {
    expect(msToCheck(fetching(4)).problems).toEqual([]);
  });
});
