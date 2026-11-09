/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Two things a world needs to put solid 3D into a photograph (Ivan,
 * 2026-11-09: "they are flat no perception of depth"):
 * - a cylinder or cone gets the rings along it its segments ask for where a
 *   vertex file can bend them, so a tube laid along a path and raised by the
 *   spectrum bends; built with one ring, as every version before built it,
 *   it stayed straight and the author fell back to flat cards. Where nothing
 *   bends it, it keeps one ring and every world made before keeps its shape
 *   and its cost;
 * - a physical material may turn its specular off, so a floor painted with
 *   the photograph behind it vanishes into it where nothing shades it.
 */

import { geometryVertices } from '../../../common/sceneWorldCost';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import type { IWorldMeshNode } from '../../../common/sceneWorld';
import { buildWorldGeometry } from '../../../renderer/graph/world/worldGeometry';

const BEND =
  'vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) { return position + vec3(0.0, 0.0, 0.1); }';

const tube = (material: string) => ({
  type: 'mesh',
  geometry: { kind: 'cylinder', radius: 0.07, segments: [16, 256] },
  material,
});

const read = (materials: Record<string, unknown>, nodes: unknown[]) =>
  normalizeSceneWorld({ materials, nodes }, []);

const geometryOf = (world: ReturnType<typeof read>, index = 0) =>
  (world?.nodes[index] as IWorldMeshNode).geometry;

describe('a cylinder a vertex file bends', () => {
  it('is built with the rings along it its segments ask for', () => {
    const world = read({ bent: { kind: 'standard', vertex: BEND } }, [
      tube('bent'),
    ]);
    expect(geometryOf(world).segments).toEqual([16, 256]);
    // 17 vertices a ring, 257 rings, and the two caps.
    expect(geometryVertices(geometryOf(world))).toBe(17 * 257 + 33 * 2);
  });

  it('is drawn with as many vertices as the budget counts, bent or not', () => {
    const bent = read({ bent: { kind: 'standard', vertex: BEND } }, [
      tube('bent'),
      {
        type: 'mesh',
        geometry: { kind: 'cone', radius: 1, segments: [12, 30] },
        material: 'bent',
      },
    ]);
    const plain = read({}, [tube('none')]);
    [geometryOf(bent, 0), geometryOf(bent, 1), geometryOf(plain)].forEach(
      (shape) => {
        expect(buildWorldGeometry(shape).getAttribute('position').count).toBe(
          geometryVertices(shape),
        );
      },
    );
  });

  it('keeps one ring, its cost unchanged, where nothing bends it', () => {
    // The control: the same tube, its material with no vertex file.
    const world = read({ plain: { kind: 'standard' } }, [
      tube('plain'),
      tube('missing'),
      {
        type: 'mesh',
        geometry: { kind: 'cone', radius: 1 },
        material: 'plain',
      },
    ]);
    expect(geometryOf(world, 0).segments).toEqual([16, 1]);
    expect(geometryVertices(geometryOf(world, 0))).toBe(17 * 2 + 33 * 2);
    expect(geometryOf(world, 1).segments).toEqual([16, 1]);
    expect(geometryOf(world, 2).segments).toEqual([32, 1]);
  });

  it('bends copies too, and leaves every other shape as it was', () => {
    const world = read({ bent: { kind: 'standard', vertex: BEND } }, [
      {
        type: 'instances',
        geometry: { kind: 'cone', radius: 0.1, segments: [8, 40] },
        material: 'bent',
        layout: { kind: 'line', count: 4 },
      },
      {
        type: 'mesh',
        geometry: { kind: 'sphere', radius: 1, segments: [32, 16] },
        material: 'plain',
      },
    ]);
    expect(geometryOf(world, 0).segments).toEqual([8, 40]);
    expect(geometryOf(world, 1).segments).toEqual([32, 16]);
  });
});

describe("a physical material's specular strength", () => {
  it('is read within 0..1 when given, and absent when not', () => {
    const world = read(
      {
        catcher: { kind: 'physical', specularIntensity: 0 },
        past: { kind: 'physical', specularIntensity: 4 },
        plain: { kind: 'physical' },
      },
      // A world with nothing in it is no world: one floor to read it by.
      [{ type: 'mesh', geometry: { kind: 'plane' }, material: 'catcher' }],
    );
    expect(world?.materials.catcher.specularIntensity).toBe(0);
    expect(world?.materials.past.specularIntensity).toBe(1);
    // Absent, so a world written before it reads exactly as it did.
    expect(world?.materials.plain).not.toHaveProperty('specularIntensity');
  });
});
