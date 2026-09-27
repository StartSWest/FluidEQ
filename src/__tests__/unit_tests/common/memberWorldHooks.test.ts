/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  checkMemberWorldHook,
  MAX_MEMBER_SOURCE_BYTES,
} from '../../../common/memberSceneRules';
import {
  checkMemberScene,
  checkWorldHooks,
  readMemberScene,
} from '../../../common/memberScenes';
import { SCENE_PACK_SCHEMA } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';

/**
 * A member's 3D world runs its own GLSL per vertex and per pixel, exactly as
 * a scene's shader does, and nobody reads it before it runs. So each piece is
 * held to every rule a scene's source is, counted from its own entry point;
 * the author is told which rule and on which line of the piece, and a
 * listener's copy that breaks one plays its shader without the world.
 */

const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

const SURFACE = `void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  float glow = 0.0;
  for (int i = 0; i < 8; i++) {
    glow += texture(uSpectrumSlow, vec2(float(i) / 8.0, 0.5)).r;
  }
  emissive += s.tint * glow * uLevel;
}
`;

const DISPLACE = `vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {
  return position + normal * texture(uSpectrumSlow, vec2(v.uv.x, 0.5)).r;
}
`;

/** A fragment piece with `body` on its third line, `before` above it. */
const surface = (body: string, before = '') =>
  `${before}void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  float x = 0.0;
  ${body}
  emissive += vec3(x);
}
`;

const LOOPING = surface('while (x < uLevel) { x += 0.1; }');

const DEFINING = `vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {
#define LIFT 2.0
  return position + normal * LIFT;
}
`;

/** Three nested 128-turn loops: two million turns a pixel. */
const NESTED =
  'for (int i = 0; i < 128; i++) { for (int j = 0; j < 128; j++) { for (int k = 0; k < 128; k++) { x += 1.0; } } }';

const HEAVY = `float heavy() { float x = 0.0; ${NESTED} return x; }\n`;

const WORLD = {
  materials: {
    glow: { kind: 'glow', fragment: SURFACE },
    rock: { kind: 'standard', vertex: DISPLACE },
  },
  nodes: [
    { type: 'mesh', geometry: { kind: 'box' }, material: 'glow' },
    { type: 'mesh', geometry: { kind: 'sphere' }, material: 'rock' },
  ],
};

const withFragment = (fragment: string) => ({
  ...WORLD,
  materials: { ...WORLD.materials, glow: { kind: 'glow', fragment } },
});

const raw = (over: Record<string, unknown> = {}) => ({
  schema: SCENE_PACK_SCHEMA,
  id: 'neon-city',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Neon City' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source: SOURCE,
  params: [],
  ...over,
});

describe("a world material's GLSL, held to a scene's rules", () => {
  // The positive control every refusal below depends on.
  it('accepts a vertex and a fragment piece that keep them', () => {
    expect(checkMemberWorldHook(DISPLACE, 'vertex')).toEqual([]);
    expect(checkMemberWorldHook(SURFACE, 'fragment')).toEqual([]);
  });

  it("wants each stage's own entry point, and no other", () => {
    const missing = [{ code: 'entry-point', line: 1 }];
    expect(checkMemberWorldHook(SURFACE, 'vertex')).toEqual(missing);
    expect(checkMemberWorldHook(DISPLACE, 'fragment')).toEqual(missing);
    expect(checkMemberWorldHook(SOURCE, 'fragment')).toEqual(missing);
    expect(
      checkMemberWorldHook(
        DISPLACE.replace('vec3 worldDisplace', 'vec4 worldDisplace'),
        'vertex',
      ),
    ).toEqual(missing);
  });

  it.each([
    [
      'a preprocessor line',
      surface('x += 1.0;', '#define X 1\n'),
      'preprocessor',
      1,
    ],
    [
      'a backslash that joins two lines',
      surface('x += 1.0; \\\n  x += 2.0;'),
      'preprocessor',
      3,
    ],
    [
      'a comment that never closes',
      surface('x += 1.0; /* never closed'),
      'unterminated-comment',
      3,
    ],
    [
      'a character outside ASCII',
      surface(`float caf${String.fromCharCode(0xe9)} = 1.0;`),
      'non-ascii',
      3,
    ],
    ['a while loop', LOOPING, 'while', 3],
    ['a main of its own', surface('x += 1.0;', 'void main() {}\n'), 'main', 1],
    [
      'a loop not counted by an int',
      surface('for (float i = 0.0; i < 4.0; i += 1.0) { x += i; }'),
      'loop-shape',
      3,
    ],
    [
      'a loop past 128 turns',
      surface('for (int i = 0; i < 129; i++) { x += 1.0; }'),
      'loop-bound',
      3,
    ],
    [
      'a loop that resets its own counter',
      surface('for (int i = 0; i < 4; i++) { i = 0; x += 1.0; }'),
      'loop-assign',
      3,
    ],
    ['loops past the pixel budget', surface(NESTED), 'loop-budget', 3],
    [
      'a piece past the size of a scene',
      surface('x += 1.0;', `// ${'a'.repeat(MAX_MEMBER_SOURCE_BYTES)}\n`),
      'too-large',
      1,
    ],
  ])('refuses %s, at its line in the piece', (_name, source, code, line) => {
    expect(checkMemberWorldHook(source, 'fragment')).toEqual([{ code, line }]);
  });

  it('refuses a do loop, and the while that ends it', () => {
    expect(
      checkMemberWorldHook(
        surface('do { x += 0.1; } while (x < 1.0);'),
        'fragment',
      ),
    ).toEqual([
      { code: 'do', line: 3 },
      { code: 'while', line: 3 },
    ]);
  });

  it('counts the pixel budget from the entry point of the stage it runs in', () => {
    // A helper nothing calls costs nothing; called, its loops are the entry's.
    expect(
      checkMemberWorldHook(`${HEAVY}${surface('x += 1.0;')}`, 'fragment'),
    ).toEqual([]);
    expect(
      checkMemberWorldHook(`${HEAVY}${surface('x += heavy();')}`, 'fragment'),
    ).toEqual([{ code: 'loop-budget', line: 1 }]);
    const displacing = (call: string) =>
      `${HEAVY}vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {\n  return position * ${call};\n}\n`;
    expect(checkMemberWorldHook(displacing('1.0'), 'vertex')).toEqual([]);
    expect(checkMemberWorldHook(displacing('heavy()'), 'vertex')).toEqual([
      { code: 'loop-budget', line: 1 },
    ]);
    // A vertex piece's worldSurface never runs, so its loops are nobody's.
    expect(
      checkMemberWorldHook(`${DISPLACE}${surface(NESTED)}`, 'vertex'),
    ).toEqual([]);
  });
});

describe("every material's GLSL in a world", () => {
  it('reports each broken rule at its line in the piece that breaks it', () => {
    const violations = checkWorldHooks({
      materials: {
        glow: { kind: 'glow', fragment: LOOPING },
        rock: { kind: 'standard', vertex: DEFINING, fragment: SURFACE },
      },
    });
    expect(violations).toHaveLength(2);
    expect(violations).toEqual(
      expect.arrayContaining([
        { code: 'while', line: 3 },
        { code: 'preprocessor', line: 2 },
      ]),
    );
  });

  it('finds nothing to check where there is no GLSL', () => {
    expect(checkWorldHooks(WORLD)).toEqual([]);
    expect(checkWorldHooks(undefined)).toEqual([]);
    expect(checkWorldHooks('a world')).toEqual([]);
    expect(checkWorldHooks({ materials: ['glow'] })).toEqual([]);
    expect(
      checkWorldHooks({ materials: { glow: 'glow', rim: { fragment: 42 } } }),
    ).toEqual([]);
  });
});

describe("the author's check of a scene with a world", () => {
  // The positive control: without it, "refused" and "never accepted" read
  // the same in every case below.
  it('accepts a world whose GLSL keeps the rules, with its GLSL', () => {
    const result = checkMemberScene(raw({ world: WORLD }));
    expect(result).toMatchObject({
      ok: true,
      pack: {
        world: {
          materials: {
            glow: { fragment: SURFACE },
            rock: { vertex: DISPLACE },
          },
        },
      },
    });
  });

  it('names a rule a world breaks, in the world, at its line', () => {
    expect(checkMemberScene(raw({ world: withFragment(LOOPING) }))).toEqual({
      ok: false,
      problems: [{ code: 'while', file: 'world', line: 3 }],
    });
  });

  it("names the shader's rules and the world's apart", () => {
    const result = checkMemberScene(
      raw({
        source: `${SOURCE}\nvoid main() {}\n`,
        world: withFragment(LOOPING),
      }),
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        { code: 'main', file: 'source', line: 5 },
        { code: 'while', file: 'world', line: 3 },
      ],
    });
  });

  it.each([
    ['no nodes', { materials: WORLD.materials, nodes: [] }],
    ['only kinds this version cannot draw', { nodes: [{ type: 'hologram' }] }],
    ['materials and nothing wearing them', { materials: WORLD.materials }],
    ['text', 'a world'],
    ['null', null],
  ])(
    'says a world with %s is wrong, rather than play the shader alone',
    (_name, world) => {
      expect(checkMemberScene(raw({ world }))).toEqual({
        ok: false,
        problems: [{ code: 'bad-world', file: 'world' }],
      });
    },
  );

  it('asks nothing of a scene with no world', () => {
    const result = checkMemberScene(raw());
    expect(result.ok).toBe(true);
    expect(result.ok && result.pack.world).toBeUndefined();
  });
});

describe("a listener's copy of a scene with a world", () => {
  it('plays a world whose GLSL keeps the rules', () => {
    const pack = readMemberScene(raw({ world: WORLD }));
    expect(pack?.world?.materials.glow.fragment).toBe(SURFACE);
    expect(pack?.world?.nodes).toHaveLength(2);
  });

  it.each([
    ['a while loop', withFragment(LOOPING)],
    [
      'a preprocessor line',
      {
        ...WORLD,
        materials: { ...WORLD.materials, rock: { vertex: DEFINING } },
      },
    ],
    [
      'a piece without its entry point',
      withFragment('float glow() { return uLevel; }\n'),
    ],
  ])('plays the shader without a world whose GLSL has %s', (_name, world) => {
    const pack = readMemberScene(raw({ world }));
    expect(pack).toMatchObject({ id: 'neon-city', source: SOURCE });
    expect(pack).not.toHaveProperty('world');
  });

  it('plays the shader without a world that has nothing left to draw', () => {
    const pack = readMemberScene(raw({ world: { nodes: [] } }));
    expect(pack).toMatchObject({ id: 'neon-city', source: SOURCE });
    expect(pack).not.toHaveProperty('world');
  });
});
