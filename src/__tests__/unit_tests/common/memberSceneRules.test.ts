/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  blankGlslComments,
  checkMemberSceneSource,
  MAX_MEMBER_SOURCE_BYTES,
  stripGlslComments,
} from '../../../common/memberSceneRules';

// Every rule below is only meaningful beside this: a realistic scene, with
// comments that mention everything the rules forbid, passes untouched.
const GOOD = `// A scene that uses # and while and main() in its notes — moiré, ×2.
/* Block comment: #define FOO, do { } while (1); */
const int BIRDS = 5;
const float TAU = 6.2831853;
float band(float f) { return texture(uSpectrumSlow, vec2(f, 0.5)).r; }
vec4 sceneColour(vec2 uv) {
  vec3 colour = vec3(0.0);
  for (int i = 0; i < BIRDS; i++) {
    colour += uAccent * band(float(i) / 5.0) * 0.1;
  }
  for (int k = 3; k >= 0; k--) {
    colour *= 0.98 + 0.01 * float(k);
  }
  for (int j = 0; j <= 126; j += 2) colour += vec3(0.0001);
  return vec4(colour * uLevel, 1.0);
}
`;

const codes = (source: string) =>
  checkMemberSceneSource(source).map((violation) => violation.code);

describe('member scene rules', () => {
  it('accepts a realistic scene, whatever its comments say', () => {
    expect(checkMemberSceneSource(GOOD)).toEqual([]);
  });

  it('strips every comment for sharing, and what is left still passes', () => {
    const stripped = stripGlslComments(GOOD);
    expect(stripped).not.toBeNull();
    expect(stripped).not.toMatch(/\/\/|\/\*|moiré|#define/);
    expect(stripped).toContain('vec4 sceneColour(vec2 uv) {');
    expect(checkMemberSceneSource(stripped ?? '')).toEqual([]);
    expect(stripGlslComments('/* never closed')).toBeNull();
  });

  it('blanks comments without moving any line', () => {
    const blanked = blankGlslComments('a // x\n/* y\nz */ b');
    expect(blanked).toBe('a     \n    \n     b');
    expect(blankGlslComments('/* never closed')).toBeNull();
  });

  it.each([
    ['a preprocessor line', '#define GLOW 1.0\n', 'preprocessor'],
    ['a while loop', 'float f() { while (true) {} return 0.0; }\n', 'while'],
    ['a do loop', 'float f() { do { } while (false); return 0.0; }\n', 'do'],
    ['a main function', 'void main() {}\n', 'main'],
    [
      'a variable bound',
      'float f(int n) { for (int i = 0; i < n; i++) {} return 0.0; }\n',
      'loop-shape',
    ],
    [
      'a bound over 128',
      'float f() { for (int i = 0; i < 129; i++) {} return 0.0; }\n',
      'loop-bound',
    ],
    [
      'a step the wrong way',
      'float f() { for (int i = 0; i < 4; i--) {} return 0.0; }\n',
      'loop-shape',
    ],
    [
      'an assigned loop variable',
      'float f() { for (int i = 0; i < 4; i++) { i = 0; } return 0.0; }\n',
      'loop-assign',
    ],
    ['non-ASCII code', 'float café = 1.0;\n', 'non-ascii'],
  ])('refuses %s', (_name, extra, code) => {
    expect(codes(`${extra}${GOOD}`)).toContain(code);
    // The same scene without the extra lines is the control for each case.
    expect(codes(GOOD)).not.toContain(code);
  });

  it('refuses a block comment that never closes', () => {
    // After the scene, so no later `*/` in it can close the comment.
    expect(codes(`${GOOD}/* open\n`)).toEqual(['unterminated-comment']);
  });

  it('refuses a source with no sceneColour', () => {
    expect(codes('vec4 other(vec2 uv) { return vec4(1.0); }\n')).toEqual([
      'entry-point',
    ]);
  });

  it('refuses a source over 64 KB and accepts one just under', () => {
    const pad = (bytes: number) => `// ${'x'.repeat(bytes)}\n`;
    const room =
      MAX_MEMBER_SOURCE_BYTES - new TextEncoder().encode(GOOD).length;
    expect(codes(`${pad(room - 5)}${GOOD}`)).toEqual([]);
    expect(codes(`${pad(room + 5)}${GOOD}`)).toContain('too-large');
  });

  it('points at the line that broke the rule', () => {
    const [violation] = checkMemberSceneSource(`${GOOD}\n\n#pragma x\n`);
    // GOOD is sixteen lines, then two blank ones: the directive is line 19.
    expect(violation).toEqual({ code: 'preprocessor', line: 19 });
  });

  it('reports each rule once, in line order', () => {
    const source = `#a\n#b\nvoid main() {}\n${GOOD}`;
    expect(checkMemberSceneSource(source)).toEqual([
      { code: 'preprocessor', line: 1 },
      { code: 'main', line: 3 },
    ]);
  });
});
