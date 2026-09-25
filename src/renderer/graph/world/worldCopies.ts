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
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Points,
  Quaternion,
  Vector3,
} from 'three';
import {
  WORLD_INSTANCE_SIGNALS,
  type IWorldInstanceMotion,
  type IWorldInstancesNode,
  type IWorldLayout,
  type IWorldPointsNode,
} from 'common/sceneWorld';
import {
  createColourFormula,
  createVec3Formula,
  variesPerFrame,
  type IWorldColourFormula,
  type IWorldVec3Formula,
} from './worldFormula';
import {
  buildWorldGeometry,
  layoutSlots,
  type IWorldSlot,
} from './worldGeometry';
import type { IWorldInputs } from './worldInputs';
import {
  buildPointsMaterial,
  type IWorldMaterialContext,
  type IWorldMaterialHandle,
} from './worldMaterials';

/**
 * Sets of copies — pillars round a ring, shards in orbit, dust in the air —
 * each moved by its own formulas, once per copy.
 *
 * A copy's formulas are split by what they change with. Everything that
 * reads only the copy's own numbers (its place in the layout, its `rand`) is
 * worked out once; only what reads the music is worked out every frame, and
 * a set with nothing of that kind costs nothing after it is built.
 */

const PER_COPY = new Set<string>(WORLD_INSTANCE_SIGNALS);

interface ICopyMotion {
  position: IWorldVec3Formula;
  rotation: IWorldVec3Formula;
  scale: IWorldVec3Formula;
  colour?: IWorldColourFormula;
  live: boolean;
}

const readMotion = (
  motion: IWorldInstanceMotion,
  inputs: IWorldInputs,
  copies: number,
): ICopyMotion => {
  const make = (source: IWorldInstanceMotion['position']) =>
    createVec3Formula(
      source,
      inputs.instanceRuntime,
      inputs.instanceScope,
      copies,
    );
  const position = make(motion.position);
  const rotation = make(motion.rotation);
  const scale = make(motion.scale);
  const colour = motion.colour
    ? createColourFormula(
        motion.colour,
        inputs.instanceRuntime,
        inputs.instanceScope,
        copies,
      )
    : undefined;
  const formulas = [position, rotation, scale].flatMap((vec) => [
    vec.x,
    vec.y,
    vec.z,
  ]);
  const live =
    formulas.some((formula) => variesPerFrame(formula, PER_COPY)) ||
    (colour !== undefined && variesPerFrame(colour, PER_COPY));
  return { position, rotation, scale, ...(colour ? { colour } : {}), live };
};

/** Writes copy `index`'s own numbers where its formulas read them. */
const enterCopy = (
  inputs: IWorldInputs,
  slot: IWorldSlot,
  index: number,
  count: number,
) => {
  const env = inputs.instanceEnv;
  const base = inputs.instanceBase;
  env[base] = index;
  env[base + 1] = count;
  env[base + 2] = slot.u;
  env[base + 3] = slot.rand;
  env[base + 4] = slot.rand2;
  env[base + 5] = slot.rand3;
  env[base + 6] = slot.x;
  env[base + 7] = slot.y;
  env[base + 8] = slot.z;
  env[base + 9] = slot.angle;
};

export interface IWorldCopies {
  object: InstancedMesh | Points;
  /** Every frame; does nothing for a set whose formulas ignore the music. */
  update(): void;
  dispose(): void;
}

const slotsOf = (layout: IWorldLayout) => layoutSlots(layout);

export const buildInstances = (
  node: IWorldInstancesNode,
  inputs: IWorldInputs,
  material: IWorldMaterialHandle,
): IWorldCopies => {
  const slots = slotsOf(node.layout);
  const count = slots.length;
  const geometry = buildWorldGeometry(node.geometry);
  const marks = new Float32Array(count * 4);
  slots.forEach((slot, index) => {
    marks.set([slot.u, slot.rand, index, count], index * 4);
  });
  geometry.setAttribute(
    'aWorldInstance',
    new InstancedBufferAttribute(marks, 4),
  );
  const mesh = new InstancedMesh(geometry, material.material, count);
  const motion = readMotion(node.instance, inputs, count);
  if (motion.live) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // Copies that move with the music leave any bounds worked out once.
    mesh.frustumCulled = false;
  }
  const matrix = new Matrix4();
  const place = new Vector3();
  const size = new Vector3();
  const turn = new Euler();
  const quaternion = new Quaternion();
  const tint = new Color();
  const write = () => {
    slots.forEach((slot, index) => {
      enterCopy(inputs, slot, index, count);
      const { position, rotation, scale, colour } = motion;
      place.set(
        position.x.value(index),
        position.y.value(index),
        position.z.value(index),
      );
      turn.set(
        rotation.x.value(index),
        rotation.y.value(index),
        rotation.z.value(index),
      );
      size.set(
        scale.x.value(index),
        scale.y.value(index),
        scale.z.value(index),
      );
      matrix.compose(place, quaternion.setFromEuler(turn), size);
      mesh.setMatrixAt(index, matrix);
      if (colour) {
        colour.apply(tint, index);
        mesh.setColorAt(index, tint);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };
  write();
  if (!motion.live) {
    mesh.computeBoundingSphere();
  }
  return {
    object: mesh,
    update: motion.live ? write : () => undefined,
    dispose: () => {
      geometry.dispose();
      mesh.dispose();
    },
  };
};

export const buildPoints = (
  node: IWorldPointsNode,
  inputs: IWorldInputs,
  context: IWorldMaterialContext,
): IWorldCopies & { material: IWorldMaterialHandle } => {
  const slots = slotsOf(node.layout);
  const count = slots.length;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3).fill(1);
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(positions, 3);
  const colourAttribute = new BufferAttribute(colours, 3);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', colourAttribute);
  const material = buildPointsMaterial(node, context);
  const points = new Points(geometry, material.material);
  const motion = readMotion(node.instance, inputs, count);
  if (motion.live) {
    positionAttribute.setUsage(DynamicDrawUsage);
    colourAttribute.setUsage(DynamicDrawUsage);
    points.frustumCulled = false;
  }
  const tint = new Color();
  const write = () => {
    slots.forEach((slot, index) => {
      enterCopy(inputs, slot, index, count);
      const { position, colour } = motion;
      positions[index * 3] = position.x.value(index);
      positions[index * 3 + 1] = position.y.value(index);
      positions[index * 3 + 2] = position.z.value(index);
      if (colour) {
        colour.apply(tint, index);
        colours[index * 3] = tint.r;
        colours[index * 3 + 1] = tint.g;
        colours[index * 3 + 2] = tint.b;
      }
    });
    positionAttribute.needsUpdate = true;
    colourAttribute.needsUpdate = true;
  };
  write();
  if (!motion.live) {
    geometry.computeBoundingSphere();
  }
  return {
    object: points,
    material,
    update: () => {
      material.update();
      if (motion.live) {
        write();
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
