/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  Vector3,
  type Camera,
} from 'three';
import type { IWorldRibbonNode } from 'common/sceneWorld';
import { hash01 } from 'common/worldExpressionLexicon';
import {
  createColourFormula,
  createFormula,
  createVec3Formula,
} from './worldFormula';
import type { IWorldInputs } from './worldInputs';
import type { IWorldMaterialHandle } from './worldMaterials';

/**
 * A band of light drawn through the world along a formula — a waveform
 * strung between the pillars, a comet's tail — turned to face the camera
 * at every point, so it reads as a ribbon from any side rather than as a
 * sheet seen edge on.
 */

export interface IWorldRibbon {
  object: Mesh;
  update(): void;
  dispose(): void;
}

export const buildRibbon = (
  node: IWorldRibbonNode,
  inputs: IWorldInputs,
  material: IWorldMaterialHandle,
  camera: Camera,
): IWorldRibbon => {
  const samples = node.segments + 1;
  const positions = new Float32Array(samples * 2 * 3);
  const normals = new Float32Array(samples * 2 * 3);
  const colours = new Float32Array(samples * 2 * 3);
  const uvs = new Float32Array(samples * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < node.segments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (let i = 0; i < samples; i += 1) {
    const u = i / node.segments;
    uvs.set([u, 0, u, 1], i * 4);
  }
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(positions, 3).setUsage(
    DynamicDrawUsage,
  );
  const normalAttribute = new BufferAttribute(normals, 3).setUsage(
    DynamicDrawUsage,
  );
  const colourAttribute = new BufferAttribute(colours, 3).setUsage(
    DynamicDrawUsage,
  );
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', normalAttribute);
  geometry.setAttribute('color', colourAttribute);
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const mesh = new Mesh(geometry, material.material);
  mesh.frustumCulled = false;

  const point = createVec3Formula(
    node.point,
    inputs.instanceRuntime,
    inputs.instanceScope,
    samples,
  );
  const width = createFormula(
    node.width,
    inputs.instanceRuntime,
    inputs.instanceScope,
    samples,
  );
  const colour = createColourFormula(
    node.colour,
    inputs.instanceRuntime,
    inputs.instanceScope,
    samples,
  );
  const centre = Array.from({ length: samples }, () => new Vector3());
  const halfWidths = new Float32Array(samples);
  const eye = new Vector3();
  const along = new Vector3();
  const toEye = new Vector3();
  const side = new Vector3();
  const facing = new Vector3();
  const tint = new Color();

  const update = () => {
    const env = inputs.instanceEnv;
    const base = inputs.instanceBase;
    for (let i = 0; i < samples; i += 1) {
      const u = i / node.segments;
      env[base] = i;
      env[base + 1] = samples;
      env[base + 2] = u;
      env[base + 3] = hash01(i);
      env[base + 4] = hash01(i + 0.37);
      env[base + 5] = hash01(i + 0.71);
      env[base + 6] = 0;
      env[base + 7] = 0;
      env[base + 8] = 0;
      env[base + 9] = 0;
      centre[i].set(point.x.value(i), point.y.value(i), point.z.value(i));
      halfWidths[i] = Math.max(0, width.value(i)) / 2;
      colour.apply(tint, i);
      colours.set([tint.r, tint.g, tint.b, tint.r, tint.g, tint.b], i * 6);
    }
    // The camera in the ribbon's own space, so a ribbon inside a turning
    // group still faces the viewer.
    mesh.updateWorldMatrix(true, false);
    eye.setFromMatrixPosition(camera.matrixWorld);
    mesh.worldToLocal(eye);
    for (let i = 0; i < samples; i += 1) {
      const before = centre[Math.max(0, i - 1)];
      const after = centre[Math.min(samples - 1, i + 1)];
      along.subVectors(after, before);
      if (along.lengthSq() < 1e-12) {
        along.set(1, 0, 0);
      }
      toEye.subVectors(eye, centre[i]);
      side.crossVectors(along, toEye);
      if (side.lengthSq() < 1e-12) {
        side.set(0, 1, 0);
      }
      side.normalize().multiplyScalar(halfWidths[i]);
      facing.crossVectors(side, along).normalize();
      const c = centre[i];
      positions.set(
        [
          c.x - side.x,
          c.y - side.y,
          c.z - side.z,
          c.x + side.x,
          c.y + side.y,
          c.z + side.z,
        ],
        i * 6,
      );
      normals.set(
        [facing.x, facing.y, facing.z, facing.x, facing.y, facing.z],
        i * 6,
      );
    }
    positionAttribute.needsUpdate = true;
    normalAttribute.needsUpdate = true;
    colourAttribute.needsUpdate = true;
  };
  return {
    object: mesh,
    update,
    dispose: () => geometry.dispose(),
  };
};
