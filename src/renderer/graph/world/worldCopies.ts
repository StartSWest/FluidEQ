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
  type IWorldFormula,
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
 * A copy's formulas are split by what they change with, one number at a
 * time. Everything that reads only the copy's own numbers (its place in the
 * layout, its `rand`) is worked out once and kept; only what reads the music
 * is worked out every frame, and a set with nothing of that kind costs
 * nothing after it is built. The split used to be by the whole set: a ring
 * of pillars whose heights followed the spectrum worked out all nine numbers
 * of every pillar, and its turn and its colour, every frame, to change one.
 */

const PER_COPY = new Set<string>(WORLD_INSTANCE_SIGNALS);

/** Position x, y, z, rotation x, y, z, scale x, y, z. */
const CHANNELS = 9;

interface ICopyMotion {
  /** In `CHANNELS` order. */
  channels: IWorldFormula[];
  /** The channels worked out every frame. */
  live: number[];
  turns: boolean;
  colour?: IWorldColourFormula;
  colourLive: boolean;
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
  const channels = [
    make(motion.position),
    make(motion.rotation),
    make(motion.scale),
  ].flatMap((vec) => [vec.x, vec.y, vec.z]);
  const colour = motion.colour
    ? createColourFormula(
        motion.colour,
        inputs.instanceRuntime,
        inputs.instanceScope,
        copies,
      )
    : undefined;
  const live = channels.flatMap((formula, channel) =>
    variesPerFrame(formula, PER_COPY) ? [channel] : [],
  );
  return {
    channels,
    live,
    turns: live.some((channel) => channel >= 3 && channel < 6),
    ...(colour ? { colour } : {}),
    colourLive: colour !== undefined && variesPerFrame(colour, PER_COPY),
  };
};

/** Whether anything in the set changes from frame to frame. */
const moves = (motion: ICopyMotion) =>
  motion.live.length > 0 || motion.colourLive;

/**
 * Every copy's nine numbers, worked out once, and the listed channels of
 * each copy worked out again by `refresh` — each live formula once per copy
 * per frame, as its own remembered state (`smooth`, `decay`) expects.
 */
const createCopyValues = (
  motion: ICopyMotion,
  inputs: IWorldInputs,
  slots: readonly IWorldSlot[],
) => {
  const count = slots.length;
  // Doubles, as the formulas give them: kept in single precision, a copy's
  // matrix came out a rounding away from the one worked out each frame.
  const values = new Float64Array(count * CHANNELS);
  const work = (channels: readonly number[], index: number) => {
    const at = index * CHANNELS;
    for (let c = 0; c < channels.length; c += 1) {
      const channel = channels[c];
      values[at + channel] = motion.channels[channel].value(index);
    }
  };
  const all = Array.from({ length: CHANNELS }, (_, channel) => channel);
  slots.forEach((slot, index) => {
    enterCopy(inputs, slot, index, count);
    work(all, index);
  });
  return {
    values,
    /** Copy `index`'s own numbers are already entered. */
    refresh: (index: number) => work(motion.live, index),
  };
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
  const live = moves(motion);
  const { colourLive } = motion;
  if (live) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // Copies that move with the music leave any bounds worked out once.
    mesh.frustumCulled = false;
  }
  const { values, refresh } = createCopyValues(motion, inputs, slots);
  const matrix = new Matrix4();
  const place = new Vector3();
  const size = new Vector3();
  const turn = new Euler();
  const quaternion = new Quaternion();
  // Each copy's turn as a quaternion, kept unless the turn reads the music:
  // the Euler-to-quaternion step is most of what composing a matrix costs.
  const turns = new Float64Array(count * 4);
  const turnOf = (index: number) => {
    const at = index * CHANNELS;
    turn.set(values[at + 3], values[at + 4], values[at + 5]);
    quaternion.setFromEuler(turn).toArray(turns, index * 4);
  };
  const tint = new Color();
  const setMatrix = (index: number) => {
    const at = index * CHANNELS;
    place.set(values[at], values[at + 1], values[at + 2]);
    size.set(values[at + 6], values[at + 7], values[at + 8]);
    quaternion.fromArray(turns, index * 4);
    matrix.compose(place, quaternion, size);
    mesh.setMatrixAt(index, matrix);
  };
  const paint = (index: number) => {
    if (motion.colour) {
      motion.colour.apply(tint, index);
      mesh.setColorAt(index, tint);
    }
  };
  slots.forEach((slot, index) => {
    enterCopy(inputs, slot, index, count);
    turnOf(index);
    setMatrix(index);
    paint(index);
  });
  const update = () => {
    slots.forEach((slot, index) => {
      enterCopy(inputs, slot, index, count);
      refresh(index);
      if (motion.turns) {
        turnOf(index);
      }
      setMatrix(index);
      if (colourLive) {
        paint(index);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Colours that ignore the music went up once and stay.
    if (mesh.instanceColor && colourLive) {
      mesh.instanceColor.needsUpdate = true;
    }
  };
  if (!live) {
    mesh.computeBoundingSphere();
  }
  return {
    object: mesh,
    update: live ? update : () => undefined,
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
): IWorldCopies => {
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
  // A point has a place and a colour; its turn and size are the material's.
  const motion = readMotion(node.instance, inputs, count);
  motion.live = motion.live.filter((channel) => channel < 3);
  const placesLive = motion.live.length > 0;
  const { colourLive } = motion;
  if (placesLive) {
    positionAttribute.setUsage(DynamicDrawUsage);
    points.frustumCulled = false;
  }
  if (colourLive) {
    colourAttribute.setUsage(DynamicDrawUsage);
  }
  const { values, refresh } = createCopyValues(motion, inputs, slots);
  const tint = new Color();
  const place = (index: number) => {
    positions[index * 3] = values[index * CHANNELS];
    positions[index * 3 + 1] = values[index * CHANNELS + 1];
    positions[index * 3 + 2] = values[index * CHANNELS + 2];
  };
  const paint = (index: number) => {
    if (motion.colour) {
      motion.colour.apply(tint, index);
      colours[index * 3] = tint.r;
      colours[index * 3 + 1] = tint.g;
      colours[index * 3 + 2] = tint.b;
    }
  };
  slots.forEach((slot, index) => {
    enterCopy(inputs, slot, index, count);
    place(index);
    paint(index);
  });
  const write = () => {
    slots.forEach((slot, index) => {
      enterCopy(inputs, slot, index, count);
      refresh(index);
      place(index);
      if (colourLive) {
        paint(index);
      }
    });
    positionAttribute.needsUpdate = placesLive;
    colourAttribute.needsUpdate = colourLive;
  };
  if (!placesLive) {
    geometry.computeBoundingSphere();
  }
  return {
    object: points,
    update: () => {
      material.update();
      if (placesLive || colourLive) {
        write();
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
