/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS, type TWorldNode } from '../../../common/sceneWorld';
import { geometryVertices } from '../../../common/sceneWorldCost';
import { layoutCount } from '../../../common/sceneWorldNodes';
import normalizeSceneWorld from '../../../common/sceneWorldRead';

/**
 * A world is somebody else's, and every listener's machine draws it. Each
 * bound on its own held and together they still let one world ask for four
 * billion vertices a frame; these hold the world as a whole. Each case has a
 * control beside it — a world under the budget kept whole — or "left out"
 * could not be told from "everything dropped".
 */

const sphere = { kind: 'sphere', radius: 1, segments: [256, 256] };

const copiesOf = (count: number, geometry: unknown = sphere) => ({
  type: 'instances',
  geometry,
  layout: { kind: 'scatter', count },
});

const read = (nodes: unknown[], extra: Record<string, unknown> = {}) =>
  normalizeSceneWorld({ nodes, ...extra }, []);

const kinds = (nodes: TWorldNode[] | undefined) =>
  (nodes ?? []).map((node) => node.type);

describe("a world's frame budget", () => {
  it('counts the vertices three builds for each shape', () => {
    // Worked by hand from three's builders (`worldGeometry.ts`).
    expect(
      geometryVertices({
        kind: 'sphere',
        size: [1, 1, 1],
        radius: 1,
        tube: 0.4,
        detail: 0,
        segments: [32, 16],
        knot: [2, 3],
        open: false,
      }),
    ).toBe(33 * 17);
    expect(
      geometryVertices({
        kind: 'icosahedron',
        size: [1, 1, 1],
        radius: 1,
        tube: 0.4,
        detail: 1,
        segments: [32, 16],
        knot: [2, 3],
        open: false,
      }),
    ).toBe(240);
  });

  it('leaves out copies past the vertices a frame may draw, and keeps a modest world whole', () => {
    // 60,000 spheres of 257 x 257 vertices: four billion a frame.
    const heavy = read([copiesOf(60000), { type: 'light', light: {} }]);
    expect(kinds(heavy?.nodes)).toEqual(['light']);

    const modest = read([
      copiesOf(200, { kind: 'sphere', radius: 1, segments: [16, 8] }),
      { type: 'light', light: {} },
    ]);
    expect(kinds(modest?.nodes)).toEqual(['instances', 'light']);
  });

  it('counts a mirrored world twice', () => {
    // 1,100 spheres of 33 x 17 vertices: 617,100 a set. Three sets fit
    // (1.85 million); mirrored, each counts twice and only one fits beside
    // the floor.
    const set = copiesOf(1100, {
      kind: 'sphere',
      radius: 1,
      segments: [32, 16],
    });
    const floor = {
      type: 'mesh',
      geometry: { kind: 'plane' },
      material: 'wet',
    };
    const plain = read([set, set, set]);
    const mirrored = read([floor, set, set, set], {
      materials: { wet: { kind: 'standard', mirror: 0.6 } },
    });
    expect(kinds(plain?.nodes)).toEqual([
      'instances',
      'instances',
      'instances',
    ]);
    expect(kinds(mirrored?.nodes)).toEqual(['mesh', 'instances']);
  });

  it('leaves out copies past the formulas a frame may work out', () => {
    // Nine numbers each, all reading the music: 12,000 copies is 108,000.
    const busy = {
      type: 'points',
      layout: { kind: 'scatter', count: 12000 },
      instance: {
        position: ['x + bass', 'y + mid', 'z + treble'],
      },
    };
    const calm = { ...busy, instance: { position: ['x', 'y', 'z'] } };
    expect(kinds(read([busy, busy, busy, busy])?.nodes)).toEqual([
      'points',
      'points',
    ]);
    expect(kinds(read([calm, calm, calm, calm])?.nodes)).toEqual([
      'points',
      'points',
      'points',
      'points',
    ]);
  });

  it('keeps a grid inside the copy limit however its axes round', () => {
    const grid = read([
      {
        type: 'points',
        layout: { kind: 'grid', count: [39999, 2, 1] },
      },
    ]);
    const node = grid?.nodes[0];
    const copies = node?.type === 'points' ? layoutCount(node.layout) : 0;
    expect(copies).toBeGreaterThan(0);
    expect(copies).toBeLessThanOrEqual(WORLD_LIMITS.instances);
  });
});

describe("a world's GLSL and ids", () => {
  const hook = (fill: number) =>
    `void worldSurface(inout vec4 c, inout vec3 e, WorldSurface s) {\n  e += vec3(${'1.0 + '.repeat(fill)}0.0);\n}\n`;

  it('keeps the GLSL of every material together within what a scene may be', () => {
    const big = hook(5000);
    const materials = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`m${i}`, { fragment: big }]),
    );
    const world = read([{ type: 'mesh', geometry: { kind: 'box' } }], {
      materials,
    });
    const kept = Object.values(world?.materials ?? {}).filter(
      (material) => material.fragment !== undefined,
    );
    expect(kept.length).toBeGreaterThan(0);
    expect(
      kept.reduce((sum, material) => sum + (material.fragment?.length ?? 0), 0),
    ).toBeLessThanOrEqual(WORLD_LIMITS.hookTotalBytes);
    expect(kept.length).toBeLessThan(16);
  });

  it('keeps one of two ids that differ only in capitals', () => {
    const world = read([{ type: 'mesh', geometry: { kind: 'box' } }], {
      materials: { Glow: { kind: 'glow' }, glow: { kind: 'glow' }, rim: {} },
    });
    expect(Object.keys(world?.materials ?? {})).toEqual(['Glow', 'rim']);
  });

  it('keeps a variable whose name has a capital letter', () => {
    const world = read([{ type: 'mesh', geometry: { kind: 'box' } }], {
      vars: { heroA: 'bass * 2' },
    });
    expect(world?.vars.map((known) => known.name)).toEqual(['heroA']);
  });
});
