/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  blankGlslComments,
  checkMemberSceneSource,
  MAX_MEMBER_SOURCE_BYTES,
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

  /*
   * There was a case here for `stripGlslComments`, which is gone: nothing in
   * the app ever called it, so what it tested was a protection the code
   * described and did not have. A test of an unused function is what let that
   * stand for a fortnight — it was green, so the claim beside it read as
   * kept. See the note where the function was.
   */

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

  // Each of these ran a loop without end, or past any GPU's patience, and
  // was accepted: every one was a way around the rules as first written.
  const scene = (body: string, before = '') =>
    `${before}vec4 sceneColour(vec2 uv) {\n  float s = 0.0;\n${body}\n  return vec4(s);\n}\n`;
  it.each([
    [
      'three nested loops of 128',
      scene(
        'for (int i = 0; i < 128; i++) { for (int j = 0; j < 128; j++) { for (int k = 0; k < 128; k++) { s += 1.0; } } }',
      ),
      'loop-budget',
    ],
    [
      'a helper that loops, called inside two loops',
      scene(
        'for (int i = 0; i < 128; i++) { for (int j = 0; j < 128; j++) { s += fbm(uv); } }',
        'float fbm(vec2 p) { float n = 0.0; for (int o = 0; o < 64; o++) { n += p.x; } return n; }\n',
      ),
      'loop-budget',
    ],
    [
      'a tree of calls with no loop at all',
      scene(
        's = f19(1.0);',
        `${Array.from({ length: 20 }, (_, n) =>
          n === 0
            ? 'float f0(float x) { return x * 0.5; }'
            : `float f${n}(float x) { return f${n - 1}(x) + f${n - 1}(x); }`,
        ).join('\n')}\n`,
      ),
      'loop-budget',
    ],
    [
      'heavy work beside a loop that never turns',
      scene(
        'for (int z = 0; z < 0; z++) { for (int i = 0; i < 128; i++) { for (int j = 0; j < 128; j++) { for (int k = 0; k < 128; k++) { s += 1.0; } } } }\n  for (int i = 0; i < 128; i++) { for (int j = 0; j < 128; j++) { s += 1.0; } }',
      ),
      'loop-budget',
    ],
    [
      'a bound whose constant is hidden by another of the same name',
      scene(
        'for (int i = 0; i < N; i++) { s += 1.0; }',
        'const int N = 100000000;\nfloat a() { const int N = 1; return float(N); }\n',
      ),
      'loop-shape',
    ],
    [
      'a bound that is a variable of the same name',
      scene(
        'int N = int(uv.x * 1e9);\n  for (int i = 0; i < N; i++) { s += 1.0; }',
        'const int N = 4;\n',
      ),
      'loop-shape',
    ],
    [
      'a bound that is a parameter of the same name',
      scene(
        's = g(1000000000);',
        'const int N = 4;\nfloat g(int N) { float s = 0.0; for (int i = 0; i < N; i++) { s += 1.0; } return s; }\n',
      ),
      'loop-shape',
    ],
    [
      'the counter handed to an inout parameter',
      scene(
        'for (int i = 0; i < 4; i++) { bump(i); }',
        'void bump(inout int k) { k = 0; }\n',
      ),
      'loop-assign',
    ],
    [
      'the counter reset in an else after a braceless if',
      scene(
        'for (int i = 0; i < 4; i++) if (s > 1.0) { s += 1.0; } else { i = 0; }',
      ),
      'loop-assign',
    ],
    [
      'the counter masked',
      scene('for (int i = 0; i < 4; i++) { i &= 1; }'),
      'loop-assign',
    ],
    [
      'the counter shifted',
      scene('for (int i = 0; i < 4; i++) { i >>= 1; }'),
      'loop-assign',
    ],
    [
      'the counter assigned in parentheses',
      scene('for (int i = 0; i < 4; i++) { (i) = 0; }'),
      'loop-assign',
    ],
    // Found by the security review of 2026-09-13, each accepted until then.
    [
      'a start the compiler reads as octal',
      scene('for (int i = 01000000000; i < 1000000000; i++) { s += 1.0; }'),
      'loop-shape',
    ],
    [
      'a constant the compiler reads as octal',
      scene(
        'for (int i = 0; i < N; i++) { s += 1.0; }',
        'const int N = 010;\n',
      ),
      'loop-shape',
    ],
    [
      'a counter that wraps past the largest int',
      scene('for (int i = 2147483640; i <= 2147483647; i++) { s += 1.0; }'),
      'loop-bound',
    ],
    [
      'a step that wraps past the largest int',
      scene(
        'for (int i = 2147483600; i < 2147483647; i += 1000) { s += 1.0; }',
      ),
      'loop-bound',
    ],
    [
      'a writer whose parameters hold brackets',
      scene(
        'float q[2];\n  for (int i = 0; i < 4; i++) { reset(i, q); }',
        'void reset(inout int c, float q[(2)]) { c = 0; }\n',
      ),
      'loop-assign',
    ],
    [
      'turns of a hundred and twenty-eight by a hundred and twenty-seven, each doing fifteen hundred statements',
      scene(
        `for (int i = 0; i < 128; i++) { for (int j = 0; j < 127; j++) {\n${'    s = s * 0.5 + 0.25;\n'.repeat(1500)}  } }`,
      ),
      'loop-budget',
    ],
  ])('refuses %s', (_name, source, code) => {
    expect(codes(source)).toEqual([code]);
  });

  it('accepts what those look like when they are fine', () => {
    expect(
      codes(
        scene(
          'for (int w = 0; w < 9; w++) { float u; float v; s += cover(uv * float(w), u, v); }\n  for (int i = 0; i < 16; i++) { for (int j = 0; j < 16; j++) { s += fbm(uv); } }',
          'const int OCTAVES = 5;\nfloat fbm(vec2 p) { float n = 0.0; for (int o = 0; o < OCTAVES; o++) { n += p.x; } return n; }\nfloat cover(vec2 p, out float u, out float v) { u = p.x; v = p.y; return 1.0; }\n',
        ),
      ),
    ).toEqual([]);
  });

  // A loop the compiler reads and the rules did not: a backslash joining two
  // lines, and a line comment a carriage return ends.
  it.each([
    [
      'a backslash joining a loop across two lines',
      scene(`whi${String.fromCharCode(92)}\nle (true) { s += 1.0; }`),
      ['preprocessor'],
    ],
    [
      'a loop after a line comment ended by a carriage return',
      scene('// note\rwhile (true) { s += 1.0; }'),
      ['while'],
    ],
  ])('refuses %s', (_name, source, found) => {
    expect(codes(source)).toEqual(found);
  });

  it('keeps a backslash and a carriage return inside a comment harmless', () => {
    expect(
      codes(scene(`s += 1.0; /* a ${String.fromCharCode(92)} path */`)),
    ).toEqual([]);
    expect(codes(scene('s += 1.0; // windows line\r\n  s += 1.0;'))).toEqual(
      [],
    );
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
