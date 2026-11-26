/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What look_at_scene tells the Studio's AI about a scene that is slow to
 * compile on Windows (`compileNoteLines.ts`): the member's own English words
 * with the scene.frag line, so the model that wrote the shape can rewrite it
 * — and nothing at all for a scene that reads clean.
 */

import compileNoteLines from '../../../main/studioAgent/compileNoteLines';

const SLOW = `struct Card { vec4 rect; vec2 q; float depth; float kind; float info; float below; float wide; };
Card card0, card1, card2;
int cardCount = 0;
void offer(Card c) {
  int n = cardCount;
  if (n == 0) { card0 = c; }
  else {
    if (c.depth < card0.depth) { Card t = card0; card0 = c; c = t; }
    if (n == 1) { card1 = c; }
    else {
      if (c.depth < card1.depth) { Card t = card1; card1 = c; c = t; }
      if (n == 2 || c.depth < card2.depth) card2 = c;
    }
  }
  cardCount = min(n + 1, 3);
}
vec4 sceneColour(vec2 uv) {
${[0, 1, 2].map((k) => `  offer(Card(vec4(${k}.0), uv, uv.x * ${k}.5, 0.0, 0.0, -1.0, 1.0));`).join('\n')}
  return card0.rect;
}
`;

it('names the line and says what to do, in the words the member reads', () => {
  expect(compileNoteLines(SLOW)).toEqual([
    expect.stringMatching(/^Slow to load on Windows \(a warning/),
    '- scene.frag, line 4: The list of nearest things “offer” keeps is filled from 3 places. Gather every candidate in one loop with a single insertion.',
  ]);
});

it('says nothing about a scene that reads clean', () => {
  expect(
    compileNoteLines(
      'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
    ),
  ).toEqual([]);
});
