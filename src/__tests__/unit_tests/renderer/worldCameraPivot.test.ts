/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PerspectiveCamera, Vector3 } from 'three';
import { readSceneCamera } from '../../../common/sceneCamera';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import createWorldCamera from '../../../renderer/graph/world/worldCamera';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';

/**
 * What a viewer's turn turns a 3D world about. Round what the camera looks
 * at, as a thing picked up and turned — every scene before the pivot, and
 * still the default; or, with the pack's `pivot` at `eye`, a look round from
 * where the camera stands, the zoom a longer lens — a landscape's target is
 * far off, and an orbit round it swung the camera through its own
 * foreground.
 */

const EYE = new Vector3(0, 2, 10);
const TARGET = new Vector3(0, 2, 0);

/** The camera after one frame of `pivot`, turned `view` by the viewer. */
const aimed = (
  pivot: 'target' | 'eye' | undefined,
  view: [number, number, number],
) => {
  const world = normalizeSceneWorld(
    {
      // A world is something to look at: one with nothing in it is none.
      materials: { stone: { kind: 'physical', colour: '#808080' } },
      nodes: [
        {
          type: 'mesh',
          geometry: { kind: 'icosahedron', radius: 1 },
          material: 'stone',
        },
      ],
      camera: {
        fov: 50,
        position: EYE.toArray(),
        target: TARGET.toArray(),
      },
    },
    [],
  );
  if (!world) {
    throw new Error('the world did not read');
  }
  const inputs = createWorldInputs(
    { params: [], world } as unknown as IScenePack,
    null,
  );
  inputs.view = view;
  const camera = new PerspectiveCamera();
  createWorldCamera(world.camera, camera, inputs, pivot)(16 / 9);
  return camera;
};

const facing = (camera: PerspectiveCamera) =>
  camera.getWorldDirection(new Vector3());

describe("the viewer's turn of a 3D world", () => {
  it('leaves the author’s view alone when nothing is turned, either way', () => {
    const orbit = aimed('target', [0, 0, 1]);
    const look = aimed('eye', [0, 0, 1]);
    expect(look.position.toArray()).toEqual(orbit.position.toArray());
    expect(facing(look).distanceTo(facing(orbit))).toBeLessThan(1e-9);
    expect(look.fov).toBe(50);
  });

  it('orbits round what the camera looks at by default', () => {
    const camera = aimed(undefined, [0.3, 0, 1]);
    expect(camera.position.distanceTo(EYE)).toBeGreaterThan(1);
    // Still ten away, and still looking at the target.
    expect(camera.position.distanceTo(TARGET)).toBeCloseTo(10, 6);
    const toTarget = TARGET.clone().sub(camera.position).normalize();
    expect(facing(camera).distanceTo(toTarget)).toBeLessThan(1e-6);
  });

  it('looks round from where the camera stands with the eye pivot', () => {
    const camera = aimed('eye', [0.3, 0.1, 1]);
    // The camera stays put and the look turns by exactly the angles given,
    // facing the way an orbit by the same turn would: round by the yaw, and
    // down by the pitch, as a viewer raised looks down.
    expect(camera.position.distanceTo(EYE)).toBeLessThan(1e-9);
    const direction = facing(camera);
    expect(Math.atan2(-direction.x, -direction.z)).toBeCloseTo(0.3, 6);
    expect(Math.asin(direction.y)).toBeCloseTo(-0.1, 6);
  });

  it('zooms with a longer lens at the eye, and by moving in otherwise', () => {
    const lens = aimed('eye', [0, 0, 2]);
    expect(lens.fov).toBeCloseTo(25, 9);
    expect(lens.position.distanceTo(EYE)).toBeLessThan(1e-9);

    const dolly = aimed('target', [0, 0, 2]);
    expect(dolly.fov).toBe(50);
    expect(dolly.position.distanceTo(TARGET)).toBeCloseTo(5, 6);
  });

  it('is asked of a pack only as exactly "eye"', () => {
    const turn = { yaw: [-0.2, 0.2] };
    expect(readSceneCamera({ ...turn, pivot: 'eye' })?.pivot).toBe('eye');
    expect(readSceneCamera({ ...turn, pivot: 'Eye' })).not.toHaveProperty(
      'pivot',
    );
    expect(readSceneCamera({ ...turn, pivot: 'target' })).not.toHaveProperty(
      'pivot',
    );
  });
});
