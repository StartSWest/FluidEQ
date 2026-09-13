/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio code pane's colouring. The pane paints a highlighted copy of
 * the text under the textarea that holds the caret, so a piece dropped or
 * doubled here shifts every character after it away from where it is typed.
 */

import { glslPieces } from '../../../renderer/studio/glslTokens';

const LINES = [
  '  float glow = smoothstep(0.2, 1.0, uBass) * sparkle(uv); // the beat',
  'vec4 sceneColour(vec2 uv) {',
  '',
  '   ',
  'return mix(a, b, 0.5);',
];

describe("a scene's code, coloured", () => {
  it('gives back every character of the line, in order', () => {
    LINES.forEach((line) => {
      expect(
        glslPieces(line)
          .map((piece) => piece.text)
          .join(''),
      ).toBe(line);
    });
  });

  it('tells keywords, numbers, uniforms, built-ins, calls and comments apart', () => {
    const pieces = glslPieces(LINES[0]).filter(
      (piece) => piece.kind !== 'text',
    );
    expect(pieces).toEqual([
      { kind: 'keyword', text: 'float' },
      { kind: 'builtin', text: 'smoothstep' },
      { kind: 'number', text: '0.2' },
      { kind: 'number', text: '1.0' },
      { kind: 'uniform', text: 'uBass' },
      { kind: 'call', text: 'sparkle' },
      { kind: 'comment', text: '// the beat' },
    ]);
  });

  it('colours a built-in name only where it is called', () => {
    // The control: `mix` called is a built-in; a variable named `step` is not.
    expect(glslPieces('mix(a, b, t)')[0]).toEqual({
      kind: 'builtin',
      text: 'mix',
    });
    expect(
      glslPieces('float step = 1.0;').some((piece) => piece.kind === 'builtin'),
    ).toBe(false);
  });

  it('has nothing to colour on an empty line', () => {
    expect(glslPieces('')).toEqual([]);
  });
});
