/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WORLD_INSTANCE_SIGNALS,
  WORLD_LIMITS,
  WORLD_SIGNALS,
  type ISceneWorld,
  type TWorldNode,
} from '../../../common/sceneWorld';
import normalizeSceneWorld from '../../../common/sceneWorldRead';

/**
 * A pack's world read the way the rest of a pack is: every count bounded,
 * and past a bound the part left out, never the world. Each bound is held at
 * its value and one past it, so "left out" cannot be mistaken for "everything
 * dropped" and a bound moved by one is caught.
 */

const BOX = { type: 'mesh', geometry: { kind: 'box' } };

const read = (
  world: Record<string, unknown>,
  paramIds: readonly string[] = [],
): ISceneWorld | undefined => normalizeSceneWorld(world, paramIds);

const named = (count: number, prefix: string, node: Record<string, unknown>) =>
  Array.from({ length: count }, (_, i) => ({ ...node, name: `${prefix}${i}` }));

const names = (nodes: readonly TWorldNode[] | undefined) =>
  (nodes ?? []).map((node) => node.name);

const varNames = (world: ISceneWorld | undefined) =>
  (world?.vars ?? []).map((known) => known.name);

const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;

const DISPLACE =
  'vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {\n  return position + normal * uLevel;\n}\n';
const SURFACE =
  'void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {\n  emissive += colour.rgb * uBeat;\n}\n';

/** `hook` padded with a comment to exactly `bytes` bytes of UTF-8. */
const padded = (hook: string, bytes: number, fill = 'a') => {
  const head = `${hook}// `;
  const room = bytes - bytesOf(head) - 1;
  const each = bytesOf(fill);
  return `${head}${fill.repeat(Math.floor(room / each))}${'a'.repeat(room % each)}\n`;
};

describe('the bounds a world is read against', () => {
  it('are the ones the guide publishes', () => {
    expect(WORLD_LIMITS).toMatchObject({
      nodes: 512,
      depth: 8,
      materials: 64,
      lights: 16,
      shadowLights: 2,
      vars: 32,
      hookBytes: 32 * 1024,
      hookTotalBytes: 256 * 1024,
    });
  });

  it('are nothing to a world with nothing left to draw: that is no world', () => {
    expect(read({ nodes: [BOX] })?.nodes).toHaveLength(1);
    expect(read({ nodes: [] })).toBeUndefined();
    expect(read({ nodes: [{ type: 'hologram' }, 'a box'] })).toBeUndefined();
    expect(read({ materials: { glow: { kind: 'glow' } } })).toBeUndefined();
    expect(normalizeSceneWorld('a world', [])).toBeUndefined();
  });
});

describe('the nodes of a world', () => {
  it('keeps 512 and leaves out the 513th, not the world', () => {
    const groups = named(WORLD_LIMITS.nodes + 1, 'g', { type: 'group' });
    expect(read({ nodes: groups.slice(0, -1) })?.nodes).toHaveLength(512);
    expect(names(read({ nodes: groups })?.nodes)).toEqual(
      groups.slice(0, -1).map((group) => group.name),
    );
  });

  it('counts children against the same 512 as the top of the tree', () => {
    const world = read({
      nodes: [
        { type: 'group', children: named(512, 'c', { type: 'group' }) },
        { type: 'group', name: 'after' },
      ],
    });
    // The parent is one, so its 512th child is the 513th node.
    expect(world?.nodes).toHaveLength(1);
    expect(world?.nodes[0].children).toHaveLength(511);
  });

  describe('eight deep', () => {
    const chain = (depth: number): Record<string, unknown> =>
      depth === 1
        ? { type: 'group', name: 'deepest' }
        : {
            type: 'group',
            name: `level${depth}`,
            children: [chain(depth - 1)],
          };
    const depthOf = (node: TWorldNode): number =>
      1 + Math.max(0, ...node.children.map(depthOf));
    const bottom = (node: TWorldNode): TWorldNode =>
      node.children.length === 0 ? node : bottom(node.children[0]);

    it('keeps a tree 8 deep whole', () => {
      const [top] = read({ nodes: [chain(8)] })?.nodes ?? [];
      expect(depthOf(top)).toBe(8);
      expect(bottom(top).name).toBe('deepest');
    });

    it('leaves out the ninth level and keeps the eight above it', () => {
      const [top] = read({ nodes: [chain(9)] })?.nodes ?? [];
      expect(depthOf(top)).toBe(8);
      expect(bottom(top).name).toBe('level2');
    });
  });
});

describe('the lights of a world', () => {
  const light = (kind: string, shadow = false) => ({
    type: 'light',
    light: { kind, shadow },
  });

  it('keeps 16 and leaves out the 17th, wherever in the tree it stands', () => {
    const lights = named(WORLD_LIMITS.lights + 1, 'l', light('point'));
    expect(read({ nodes: lights.slice(0, -1) })?.nodes).toHaveLength(16);
    expect(names(read({ nodes: lights })?.nodes)).toEqual(
      lights.slice(0, -1).map((lamp) => lamp.name),
    );
    const nested = read({
      nodes: [
        ...lights.slice(0, -1),
        { type: 'group', name: 'lamp', children: [light('spot')] },
      ],
    });
    const lamp = nested?.nodes[WORLD_LIMITS.lights];
    expect(lamp?.name).toBe('lamp');
    expect(lamp?.children).toEqual([]);
  });

  it('lets two cast shadows, and only the kinds that can', () => {
    const world = read({
      nodes: [
        light('ambient', true),
        light('hemisphere', true),
        light('directional', true),
        light('spot', true),
        light('point', true),
        light('directional', false),
      ],
    });
    expect(
      (world?.nodes ?? []).map((node) =>
        node.type === 'light' ? node.light.shadow : 'not a light',
      ),
    ).toEqual([false, false, true, true, false, false]);
  });
});

describe('the variables of a world', () => {
  it('keeps 32 and leaves out the 33rd', () => {
    const vars = Object.fromEntries(
      Array.from({ length: WORLD_LIMITS.vars + 1 }, (_, i) => [`v${i}`, '1']),
    );
    expect(varNames(read({ vars, nodes: [BOX] }))).toEqual(
      Object.keys(vars).slice(0, -1),
    );
  });

  it.each([
    ['a', true],
    [`a${'b'.repeat(23)}`, true],
    [`a${'b'.repeat(24)}`, false],
    ['heroA_2', true],
    ['2nd', false],
    ['_hidden', false],
    ['kick-drum', false],
    ['p.glow', false],
    ['two words', false],
    ['', false],
  ])('reads %p as a variable name: %p', (name, kept) => {
    const world = read({ vars: { [name]: 'bass' }, nodes: [BOX] });
    expect(varNames(world)).toEqual(kept ? [name] : []);
  });

  it.each([...WORLD_SIGNALS, ...WORLD_INSTANCE_SIGNALS, 'pi', 'tau', 'e'])(
    'leaves out a variable named %s, which a formula already reads',
    (name) => {
      const world = read({
        vars: { [name]: '1', kick: 'decay(beat, 0.3)' },
        nodes: [BOX],
      });
      expect(varNames(world)).toEqual(['kick']);
    },
  );

  it('lets a variable use those before it, never itself or one after it', () => {
    expect(
      read({ vars: { first: 'bass', second: 'first * 2' }, nodes: [BOX] })
        ?.vars,
    ).toEqual([
      { name: 'first', value: 'bass' },
      { name: 'second', value: 'first * 2' },
    ]);
    expect(
      varNames(
        read({ vars: { early: 'late * 2', late: 'bass' }, nodes: [BOX] }),
      ),
    ).toEqual(['late']);
    expect(
      varNames(read({ vars: { self: 'self + 1' }, nodes: [BOX] })),
    ).toEqual([]);
  });

  it('keeps the first of two variables of one name', () => {
    const world = read({
      vars: [
        { name: 'kick', value: 'beat' },
        { name: 'kick', value: 'bass' },
      ],
      nodes: [BOX],
    });
    expect(world?.vars).toEqual([{ name: 'kick', value: 'beat' }]);
  });

  it("reads the pack's own parameters as p.<id>, and only those it has", () => {
    const vars = { glowing: 'p.glow * 2' };
    expect(varNames(read({ vars, nodes: [BOX] }, ['glow']))).toEqual([
      'glowing',
    ]);
    expect(varNames(read({ vars, nodes: [BOX] }, []))).toEqual([]);
  });

  it('is what a formula elsewhere in the world may name, once kept', () => {
    const world = read({
      vars: { kick: 'decay(beat, 0.3)', broken: 'nope * 2' },
      nodes: [{ ...BOX, position: ['kick', 'broken', 3] }],
    });
    expect(world?.nodes[0].position).toEqual(['kick', 0, 3]);
  });
});

describe('the materials of a world', () => {
  it('keeps 64 and leaves out the 65th', () => {
    const materials = Object.fromEntries(
      Array.from({ length: WORLD_LIMITS.materials + 1 }, (_, i) => [
        `m${i}`,
        { kind: 'basic' },
      ]),
    );
    expect(
      Object.keys(read({ materials, nodes: [BOX] })?.materials ?? {}),
    ).toEqual(Object.keys(materials).slice(0, -1));
  });

  it('keeps an id that starts with a letter and runs to 32 of letters, digits, - and _', () => {
    const world = read({
      materials: {
        'wet-floor_2': {},
        [`a${'b'.repeat(31)}`]: {},
        [`a${'b'.repeat(32)}`]: {},
        '2nd': {},
        '-rim': {},
        'has space': {},
        'dot.ted': {},
      },
      nodes: [BOX],
    });
    expect(Object.keys(world?.materials ?? {})).toEqual([
      'wet-floor_2',
      `a${'b'.repeat(31)}`,
    ]);
  });
});

describe("a material's own GLSL", () => {
  const worn = (material: Record<string, unknown>) =>
    read({
      materials: { core: material },
      nodes: [{ ...BOX, material: 'core' }],
    })?.materials.core;

  it('keeps a vertex piece that defines worldDisplace and a fragment piece that defines worldSurface', () => {
    expect(worn({ vertex: DISPLACE, fragment: SURFACE })).toMatchObject({
      vertex: DISPLACE,
      fragment: SURFACE,
    });
  });

  it('leaves out a piece without its own entry point, and keeps the material', () => {
    const swapped = worn({
      kind: 'physical',
      vertex: SURFACE,
      fragment: DISPLACE,
    });
    expect(swapped?.kind).toBe('physical');
    expect(swapped?.vertex).toBeUndefined();
    expect(swapped?.fragment).toBeUndefined();
    expect(
      worn({
        vertex: DISPLACE.replace('vec3 worldDisplace', 'vec4 worldDisplace'),
      })?.vertex,
    ).toBeUndefined();
    expect(worn({ fragment: 'void main() {}\n' })?.fragment).toBeUndefined();
  });

  it('leaves out a piece that declares its own #version, on any line', () => {
    expect(
      worn({ fragment: `#version 300 es\n${SURFACE}` })?.fragment,
    ).toBeUndefined();
    expect(
      worn({ fragment: `${SURFACE}  #version 100\n` })?.fragment,
    ).toBeUndefined();
    // Words in a comment are not a directive.
    const mentioned = `// never a #version of its own\n${SURFACE}`;
    expect(worn({ fragment: mentioned })?.fragment).toBe(mentioned);
  });

  it('leaves out a piece whose #version has space after the #, which GLSL reads as the same line', () => {
    expect(
      worn({ fragment: `#  version 300 es\n${SURFACE}` })?.fragment,
    ).toBeUndefined();
    expect(
      worn({ vertex: `${DISPLACE}#\tversion 100\n` })?.vertex,
    ).toBeUndefined();
  });

  it('keeps a piece of 32 KB and leaves out one byte more, counted in bytes, not characters', () => {
    const atLimit = padded(SURFACE, WORLD_LIMITS.hookBytes);
    const over = padded(SURFACE, WORLD_LIMITS.hookBytes + 1);
    // Two bytes of UTF-8 each: the piece is short in characters, long in bytes.
    const wide = padded(
      SURFACE,
      WORLD_LIMITS.hookBytes + 2,
      String.fromCharCode(0xe9),
    );
    expect(bytesOf(atLimit)).toBe(32768);
    expect(bytesOf(over)).toBe(32769);
    expect(wide.length).toBeLessThan(WORLD_LIMITS.hookBytes);

    expect(worn({ fragment: atLimit })?.fragment).toBe(atLimit);
    expect(worn({ fragment: over })?.fragment).toBeUndefined();
    expect(worn({ fragment: wide })?.fragment).toBeUndefined();
  });

  it('keeps 256 KB of every material’s GLSL together, vertex and fragment alike, and no byte more', () => {
    const vertex = padded(DISPLACE, WORLD_LIMITS.hookBytes);
    const fragment = padded(SURFACE, WORLD_LIMITS.hookBytes);
    const world = read({
      materials: {
        ...Object.fromEntries(
          Array.from({ length: 4 }, (_, i) => [
            `full${i}`,
            { vertex, fragment },
          ]),
        ),
        late: { kind: 'glow', vertex: DISPLACE },
      },
      nodes: [BOX],
    });
    const materials = world?.materials ?? {};
    expect(
      Object.values(materials).reduce(
        (sum, material) =>
          sum +
          bytesOf(material.vertex ?? '') +
          bytesOf(material.fragment ?? ''),
        0,
      ),
    ).toBe(WORLD_LIMITS.hookTotalBytes);
    expect(materials.full3).toMatchObject({ vertex, fragment });
    expect(materials.late.kind).toBe('glow');
    expect(materials.late.vertex).toBeUndefined();
  });

  it('spends the budget in order: a piece too big for what is left does not stop a smaller one after it', () => {
    const full = padded(SURFACE, WORLD_LIMITS.hookBytes);
    const most = padded(SURFACE, 30000);
    const world = read({
      materials: {
        ...Object.fromEntries(
          Array.from({ length: 7 }, (_, i) => [`full${i}`, { fragment: full }]),
        ),
        most: { fragment: most },
        tooBig: { fragment: full },
        small: { fragment: SURFACE },
      },
      nodes: [BOX],
    });
    const kept = Object.entries(world?.materials ?? {}).map(
      ([id, material]) => [id, material.fragment !== undefined],
    );
    expect(kept).toEqual([
      ...Array.from({ length: 7 }, (_, i) => [`full${i}`, true]),
      ['most', true],
      ['tooBig', false],
      ['small', true],
    ]);
  });
});

describe("the words an object's own machinery answers to", () => {
  // JSON.parse makes `__proto__` an ordinary key of the parsed object, which
  // is exactly how a pack arrives; an object literal would set a prototype.
  const parsed = (json: string): Record<string, unknown> => {
    const value: unknown = JSON.parse(json);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('not a world');
    }
    return { ...value };
  };

  it('never takes __proto__ as a material or a variable, and never reaches the prototype through one', () => {
    const world = read(
      parsed(
        '{"materials":{"__proto__":{"kind":"glow","polluted":true},"glow":{"kind":"glow"}},' +
          '"vars":{"__proto__":"1","kick":"beat"},' +
          '"nodes":[{"type":"mesh","geometry":{"kind":"box"},"material":"__proto__"}]}',
      ),
    );
    expect(Object.keys(world?.materials ?? {})).toEqual(['glow']);
    expect(Object.getPrototypeOf(world?.materials)).toBe(Object.prototype);
    expect(varNames(world)).toEqual(['kick']);
    expect(world?.nodes[0]).toMatchObject({ type: 'mesh', material: '' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).kind).toBeUndefined();
  });

  it('dresses an object in a material the world defines, never in one its record inherits', () => {
    // `constructor` is an ordinary id to this reader: every lookup asks the
    // world's own entries, so only a material the world wrote can answer.
    const world = read(
      parsed(
        '{"materials":{"constructor":{"kind":"glow"}},' +
          '"nodes":[' +
          '{"type":"mesh","geometry":{"kind":"box"},"material":"constructor"},' +
          '{"type":"mesh","geometry":{"kind":"box"},"material":"toString"},' +
          '{"type":"mesh","geometry":{"kind":"box"},"material":"hasOwnProperty"}]}',
      ),
    );
    expect(Object.keys(world?.materials ?? {})).toEqual(['constructor']);
    expect(world?.materials.constructor).toMatchObject({ kind: 'glow' });
    expect(
      (world?.nodes ?? []).map((node) =>
        node.type === 'mesh' ? node.material : 'not a mesh',
      ),
    ).toEqual(['constructor', '', '']);
    expect({}.constructor).toBe(Object);
  });
});
