/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { InstancedMesh, Mesh, PerspectiveCamera, type Object3D } from 'three';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';
import { buildWorldNodes } from '../../../renderer/graph/world/worldNodes';

// Models are not built here; their loader's add-ons are ES modules Jest
// does not transform.
jest.mock('three/examples/jsm/utils/SkeletonUtils.js', () => ({
  clone: jest.fn(),
}));

/**
 * A shape whose own GLSL moves its vertices is drawn wherever that GLSL puts
 * it, which no bounds worked out from its geometry know, so three must
 * never skip it as out of view: copies laid out by `worldDisplace` from a
 * unit plane each all stood at the origin, and on a panel that did not see
 * the origin the whole set was skipped. A shape nothing moves keeps being
 * skipped where it is out of view: its bounds are its own.
 */

const DISPLACE = `vec3 worldDisplace(vec3 p, vec3 n, WorldVertex v) {
  return p + vec3(40.0, 0.0, 0.0);
}`;

const MATERIALS = {
  moved: { kind: 'glow', vertex: DISPLACE },
  still: { kind: 'glow' },
};

/** The first node of a world of `nodes`, built. */
const firstOf = (node: Record<string, unknown>): Object3D | undefined => {
  const world = normalizeSceneWorld(
    { materials: MATERIALS, nodes: [node] },
    [],
  );
  if (!world) {
    throw new Error('the world did not read');
  }
  const pack = { params: [], world } as unknown as IScenePack;
  const inputs = createWorldInputs(pack, null);
  const build = buildWorldNodes(
    world,
    inputs,
    {
      inputs,
      declarations: '',
      atlas: null,
      fogToBackdrop: false,
      mirror: null,
    },
    {},
    new PerspectiveCamera(),
  );
  return build.root.children[0];
};

const copies = (material: string) => ({
  type: 'instances',
  geometry: { kind: 'plane', size: [1, 1, 1], segments: [1, 1] },
  material,
  layout: { kind: 'line', count: 8, from: [0, 0, 0], to: [0, 0, 0] },
  instance: { position: [0, 0, 0] },
});

const mesh = (material: string) => ({
  type: 'mesh',
  geometry: { kind: 'plane', size: [1, 1, 1] },
  material,
});

describe('a shape its own GLSL moves', () => {
  it('is never skipped as out of view, as copies', () => {
    const built = firstOf(copies('moved'));
    expect(built).toBeInstanceOf(InstancedMesh);
    expect(built?.frustumCulled).toBe(false);
  });

  it('is never skipped as out of view, as one mesh', () => {
    const built = firstOf(mesh('moved'));
    expect(built).toBeInstanceOf(Mesh);
    expect(built?.frustumCulled).toBe(false);
  });
});

describe('a shape nothing moves', () => {
  it('is still skipped where it is out of view, as copies', () => {
    const built = firstOf(copies('still'));
    expect(built).toBeInstanceOf(InstancedMesh);
    expect(built?.frustumCulled).toBe(true);
  });

  it('is still skipped where it is out of view, as one mesh', () => {
    const built = firstOf(mesh('still'));
    expect(built).toBeInstanceOf(Mesh);
    expect(built?.frustumCulled).toBe(true);
  });
});
