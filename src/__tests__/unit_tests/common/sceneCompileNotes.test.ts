/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's warnings for a scene that is slow to compile on Windows
 * (`sceneCompileNotes.ts`). Each shape that made Alpine and Hanami slow is
 * written here small, beside the same scene written the way that compiles
 * quickly — the control that has to stay silent, or a note that fires on
 * everything would pass. The thresholds were set on the real scenes: every
 * official scene in the Studio folder reads clean, and Alpine's and Hanami's
 * slow versions each earn the note for what made them slow (2026-11-26,
 * timed with Direct3D's own compiler; the numbers are in the source).
 */

import {
  compileNotesFor,
  type TCompileNote,
} from '../../../common/sceneCompileNotes';

const scene = (helpers: string, body: string) =>
  `${helpers}\nvec4 sceneColour(vec2 uv) {\n${body}\n}\n`;

/** The one-based line of the first `text` in `source`. */
const lineOf = (source: string, text: string) =>
  source.slice(0, source.indexOf(text)).split('\n').length;

/** `count` statements of work on `p`, each different, about 25 tokens each. */
const work = (count: number, salt: number) =>
  Array.from(
    { length: count },
    (_, k) =>
      `  p = p * 1.0${k % 9} + vec3(sin(p.y * ${k + salt}.1), cos(p.z * 0.${k + 1}), p.x * ${salt}.5);`,
  ).join('\n');

const codes = (notes: TCompileNote[]) => notes.map((note) => note.code);

/**
 * Far above what a hostile source takes with the budgets (under half a
 * second here) and far below what it took without them (minutes): a
 * synchronous read is not stopped by Jest's timeout, so the time is asserted.
 */
const MAX_HOSTILE_MS = 5000;

describe('a list of the nearest offered to from many places', () => {
  // Alpine's own shape: an eleven-float card, three slots, an insertion.
  const CARD = `struct Card { vec4 rect; vec2 q; float depth; float kind; float info; float below; float wide; };
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
}`;
  const card = (k: number) =>
    `Card(vec4(${k}.0), uv, uv.x * ${k}.5, ${k}.0, 0.0, -1.0, 1.0)`;
  const sixOffers = scene(
    CARD,
    `${Array.from(
      { length: 6 },
      (_, k) => `  if (uv.x > 0.${k}) offer(${card(k)});`,
    ).join('\n')}\n  return card0.rect;`,
  );

  it('is noted at the list, with how many places fill it', () => {
    expect(compileNotesFor(sixOffers)).toEqual([
      {
        code: 'nearest-offers',
        line: lineOf(sixOffers, 'void offer('),
        name: 'offer',
        sites: 6,
      },
    ]);
  });

  it('is not noted when one loop over every candidate offers once', () => {
    const oneOffer = scene(
      CARD,
      `  for (int k = 0; k < 6; k++) {
    if (uv.x > float(k) * 0.1) offer(Card(vec4(float(k)), uv, uv.x * float(k), float(k), 0.0, -1.0, 1.0));
  }
  return card0.rect;`,
    );
    expect(compileNotesFor(oneOffer)).toEqual([]);
  });

  it('is not noted for a narrow list, which measured as costing nothing', () => {
    // Hanami's: three vec4 slots offered from seven places compiled no
    // faster with the insertion cut to one compare (8.7 s against 7.2 s).
    const narrow = scene(
      `void keepHit(vec4 h, inout vec4 a, inout vec4 b, inout vec4 c) {
  if (h.x < a.x) { c = b; b = a; a = h; }
  else if (h.x < b.x) { c = b; b = h; }
  else if (h.x < c.x) { c = h; }
}`,
      `  vec4 a = vec4(1e9), b = a, c = a;
${Array.from({ length: 7 }, (_, k) => `  keepHit(vec4(uv.x * ${k}.5, ${k}.0, uv), a, b, c);`).join('\n')}
  return a;`,
    );
    expect(compileNotesFor(narrow)).toEqual([]);
  });

  it('is not noted for keeping only the nearest, which is no list', () => {
    // As wide as a list worth noting (26 floats), so only its one slot
    // tells it from one.
    const nearestOnly = scene(
      `struct Hit { mat4 m; vec4 rect; vec4 more; float t; float id; };
Hit best;
void keep(Hit h) {
  if (h.t < best.t) { best = h; }
  if (h.t > 100.0 && h.t < best.t + 1.0) { best = h; }
}`,
      `  best.t = 1e9;
${Array.from({ length: 6 }, (_, k) => `  keep(Hit(mat4(${k}.0), vec4(${k}.0), vec4(uv, uv), uv.x * ${k}.5, ${k}.0));`).join('\n')}
  return best.rect;`,
    );
    expect(compileNotesFor(nearestOnly)).toEqual([]);
  });

  it('reads the calls the compiler reads, not the ones in comments', () => {
    const commented = sixOffers.replace(
      /\s+if \(uv\.x > 0\.[1-5]\) offer\([^\n]*/g,
      (line) => ` // ${line.trim()}`,
    );
    expect(compileNotesFor(commented)).toEqual([]);
  });
});

describe('a heavy subsystem built twice', () => {
  const shade = (statements: number) =>
    `vec3 shadeAll(vec3 ro, vec3 rd) {\n  vec3 p = ro + rd;\n${work(statements, 3)}\n  return p;\n}`;

  it('is noted at the function, with how many places build it', () => {
    // A reflection with its own copy of the whole scene: Hanami's pond.
    const twice = scene(
      shade(400),
      `  vec3 rd = normalize(vec3(uv - 0.5, 1.0));
  vec3 col = shadeAll(vec3(0.0), rd);
  if (uv.y < 0.3) col = mix(col, shadeAll(vec3(uv, 0.0), reflect(rd, vec3(0.0, 1.0, 0.0))), 0.5);
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(twice)).toEqual([
      {
        code: 'repeated-subsystem',
        line: lineOf(twice, 'vec3 shadeAll('),
        name: 'shadeAll',
        sites: 2,
      },
    ]);
  });

  it('is not noted when both rays go through one two-turn loop', () => {
    const loop = scene(
      shade(400),
      `  vec3 rd = normalize(vec3(uv - 0.5, 1.0));
  vec3 seen[2];
  vec3 o = vec3(0.0);
  vec3 d = rd;
  for (int pass = 0; pass < 2; pass++) {
    seen[pass] = shadeAll(o, d);
    o = vec3(uv, 0.0);
    d = reflect(rd, vec3(0.0, 1.0, 0.0));
  }
  return vec4(uv.y < 0.3 ? mix(seen[0], seen[1], 0.5) : seen[0], 1.0);`,
    );
    expect(compileNotesFor(loop)).toEqual([]);
  });

  it('is not noted in a program small enough to compile quickly tripled', () => {
    // Aurora and Crystal repeat that much of programs this size — two
    // thirds of it here, past every other bar — and compile in 2.5 s and
    // 4.2 s.
    const small = scene(
      shade(200),
      `  vec3 col = shadeAll(vec3(0.0), vec3(uv, 1.0)) + shadeAll(vec3(1.0), vec3(uv, -1.0)) + shadeAll(vec3(2.0), vec3(uv, 2.0));
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(small)).toEqual([]);
  });
});

describe('work inside a loop that no turn changes', () => {
  const TRACE = `vec3 trace(vec3 p) {\n${work(300, 7)}\n  return p;\n}`;
  const steady = Array.from(
    { length: 60 },
    (_, k) =>
      `float s${k} = 0.${k + 1} + 0.7 * uLevel * uBand.x + uBeat * 0.${k + 2};`,
  ).join('\n    ');
  const sum = Array.from({ length: 60 }, (_, k) => `s${k}`).join(' + ');

  it('is noted at the loop', () => {
    const inside = scene(
      TRACE,
      `  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    ${steady}
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(inside)).toEqual([
      { code: 'loop-invariant', line: lineOf(inside, 'for (int i') },
    ]);
  });

  it('is not noted once that work is done before the loop', () => {
    const before = scene(
      TRACE,
      `  vec3 col = vec3(0.0);
  ${steady}
  float steadySum = ${sum};
  for (int i = 0; i < 4; i++) {
    col += trace(vec3(uv, float(i))) * steadySum;
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(before)).toEqual([]);
  });

  it('is not noted when the work changes with the turn', () => {
    const varying = scene(
      TRACE,
      `  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    ${steady.replace(/uLevel/g, 'float(i)')}
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(varying)).toEqual([]);
  });

  it('is noted when the steady work sits in a helper the loop calls', () => {
    // Hanami's sway kept its clock inside the sway, which the loop called.
    const helper = scene(
      `${TRACE}\nfloat sway(float seed) {\n    ${steady}\n  return seed * (${sum});\n}`,
      `  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    col += trace(vec3(uv, float(i))) * sway(float(i));
  }
  return vec4(col, 1.0);`,
    );
    expect(codes(compileNotesFor(helper))).toEqual(['loop-invariant']);
  });

  it('counts a helper called from several places in the loop once', () => {
    // Crystal's lamps are called from four places in its loop: counted at
    // every call, the same steady pieces read four times as much work, and
    // a scene that compiles in 4.2 s was noted.
    const few = steady.split('\n    ').slice(0, 15).join('\n    ');
    const fewSum = Array.from({ length: 15 }, (_, k) => `s${k}`).join(' + ');
    const calledFourTimes = scene(
      `${TRACE}\nfloat glow(float seed) {\n    ${few}\n  return seed * (${fewSum});\n}`,
      `  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    col += trace(vec3(uv, f)) * (glow(f) + glow(f + 1.0) + glow(f - 1.0) + glow(f * 2.0));
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(calledFourTimes)).toEqual([]);
  });

  it('is not noted for work the loop writes as it goes', () => {
    // `acc` is written every turn, so what reads it changes with the turn.
    const carried = scene(
      TRACE,
      `  vec3 col = vec3(0.0);
  float acc = uLevel;
  for (int i = 0; i < 4; i++) {
    ${steady.replace(/uLevel/g, 'acc')}
    acc = acc * 0.5 + 0.1;
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(carried)).toEqual([]);
  });
});

describe('what a loop changes through a call', () => {
  const TRACE = `vec3 trace(vec3 p) {\n${work(300, 7)}\n  return p;\n}`;
  const reads = Array.from(
    { length: 60 },
    (_, k) =>
      `float s${k} = 0.${k + 1} + 0.7 * acc * uBand.x + uBeat * 0.${k + 2};`,
  ).join('\n    ');
  const sum = Array.from({ length: 60 }, (_, k) => `s${k}`).join(' + ');

  it('follows an inout argument, which changes every turn', () => {
    const viaArgument = scene(
      `${TRACE}\nvoid step(inout float a) { a = a * 0.5 + 0.1; }`,
      `  vec3 col = vec3(0.0);
  float acc = uLevel;
  for (int i = 0; i < 4; i++) {
    step(acc);
    ${reads}
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(viaArgument)).toEqual([]);
  });

  it('follows a global a called function writes', () => {
    const viaGlobal = scene(
      `${TRACE}\nfloat acc = 0.0;\nvoid step() { acc = acc * 0.5 + 0.1; }`,
      `  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    step();
    ${reads}
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(compileNotesFor(viaGlobal)).toEqual([]);
  });

  it('notes the same reads when nothing in the loop writes them', () => {
    // The control for both: acc set once, before the loop.
    const steadyAcc = scene(
      `${TRACE}\nfloat acc = 0.0;`,
      `  vec3 col = vec3(0.0);
  acc = uLevel;
  for (int i = 0; i < 4; i++) {
    ${reads}
    col += trace(vec3(uv, float(i))) * (${sum});
  }
  return vec4(col, 1.0);`,
    );
    expect(codes(compileNotesFor(steadyAcc))).toEqual(['loop-invariant']);
  });
});

describe('what it cannot read', () => {
  it('says nothing about a comment that never closes', () => {
    expect(
      compileNotesFor('vec4 sceneColour(vec2 uv) { /* return vec4(1.0); }'),
    ).toEqual([]);
  });

  it('says nothing about a source with no sceneColour', () => {
    expect(compileNotesFor('float f(float x) { return x; }')).toEqual([]);
  });

  it('gives up on a loop of twenty thousand nested calls instead of holding the window', () => {
    // The scene rules accept this; read bracket by bracket it is twenty
    // thousand passes over a 100 KB line.
    const nested = scene(
      'float f(float a) { return a * 0.5 + 0.1; }',
      `  float x = 0.0;
  for (int i = 0; i < 4; i++) {
    x += ${'f('.repeat(20000)}float(i)${')'.repeat(20000)};
  }
  return vec4(x);`,
    );
    const started = performance.now();
    expect(compileNotesFor(nested)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(MAX_HOSTILE_MS);
  });

  it('gives up on ten thousand nested tests in a list instead of holding the window', () => {
    // Two slots of twenty floats: a list wide enough to note, which only
    // the budget keeps unread. The function itself is huge and built three
    // times, which is a note of its own and a right one.
    const deep = scene(
      `struct W { mat4 m; vec4 v; };
W a, b;
void keep(W h) {
  ${'if (h.v.x < a.v.x) { a = h; '.repeat(10000)}${'} '.repeat(10000)}
  if (h.v.x < b.v.x) { b = h; }
}`,
      `${[0, 1, 2].map((k) => `  keep(W(mat4(1.0), vec4(uv.x * ${k}.5)));`).join('\n')}
  return a.v;`,
    );
    const started = performance.now();
    expect(codes(compileNotesFor(deep))).toEqual(['repeated-subsystem']);
    expect(performance.now() - started).toBeLessThan(MAX_HOSTILE_MS);
  });
});
