/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS } from './sceneWorld';

/**
 * The parts of a glTF's table of contents a model check reads
 * (`worldModelCheck.ts`): its buffer views, accessors, meshes, node tree and
 * clips, each held to what three's loader would make of it. Every accessor
 * must lie inside the bytes the file carries, because the loader allocates
 * one that names no buffer view from its count alone, zero-filled.
 */

export const isModelRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const modelList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

export const isModelIndex = (value: unknown, length: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < length;

const isModelWhole = (value: unknown, least: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= least;

const optionalModelWhole = (
  value: unknown,
  fallback: number,
): number | null => {
  if (value === undefined) {
    return fallback;
  }
  return isModelWhole(value, 0) ? value : null;
};

/** Bytes per component, by glTF component type. */
const COMPONENT_BYTES: Readonly<Record<number, number>> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

/** Rows and columns, by accessor type. */
const ACCESSOR_SHAPES: Readonly<Record<string, readonly [number, number]>> = {
  SCALAR: [1, 1],
  VEC2: [2, 1],
  VEC3: [3, 1],
  VEC4: [4, 1],
  MAT2: [2, 2],
  MAT3: [3, 3],
  MAT4: [4, 4],
};

/** Triangles, strips and fans: points and lines three would not count. */
const TRIANGLE_MODES = new Set([4, 5, 6]);

export interface IModelView {
  offset: number;
  length: number;
  stride?: number;
}

/** Every buffer view, each inside the one buffer the file carries. */
export const readModelViews = (
  json: Record<string, unknown>,
  bodyLength: number,
): IModelView[] | null => {
  const buffers = modelList(json.buffers);
  if (buffers.length > 1) {
    return null;
  }
  let bufferLength = 0;
  if (buffers.length === 1) {
    const [buffer] = buffers;
    if (
      !isModelRecord(buffer) ||
      !isModelWhole(buffer.byteLength, 1) ||
      buffer.byteLength > bodyLength
    ) {
      return null;
    }
    bufferLength = buffer.byteLength;
  }
  const views: IModelView[] = [];
  const raw = modelList(json.bufferViews);
  for (let i = 0; i < raw.length; i += 1) {
    const view = raw[i];
    if (!isModelRecord(view) || view.buffer !== 0 || buffers.length !== 1) {
      return null;
    }
    const offset = optionalModelWhole(view.byteOffset, 0);
    const { byteLength, byteStride } = view;
    if (
      offset === null ||
      !isModelWhole(byteLength, 1) ||
      offset + byteLength > bufferLength ||
      (byteStride !== undefined &&
        (!isModelWhole(byteStride, 4) ||
          byteStride > 252 ||
          byteStride % 4 !== 0))
    ) {
      return null;
    }
    views.push({
      offset,
      length: byteLength,
      ...(byteStride === undefined ? {} : { stride: byteStride }),
    });
  }
  return views;
};

/** Each accessor's count, when every one of them lies inside its view. */
export const readAccessorCounts = (
  json: Record<string, unknown>,
  views: readonly IModelView[],
): number[] | null => {
  const counts: number[] = [];
  const raw = modelList(json.accessors);
  for (let i = 0; i < raw.length; i += 1) {
    const accessor = raw[i];
    if (
      !isModelRecord(accessor) ||
      !isModelIndex(accessor.bufferView, views.length) ||
      accessor.sparse !== undefined ||
      typeof accessor.componentType !== 'number' ||
      typeof accessor.type !== 'string' ||
      !isModelWhole(accessor.count, 1)
    ) {
      return null;
    }
    const size = COMPONENT_BYTES[accessor.componentType];
    const shape = ACCESSOR_SHAPES[accessor.type];
    const offset = optionalModelWhole(accessor.byteOffset, 0);
    if (size === undefined || shape === undefined || offset === null) {
      return null;
    }
    const [rows, columns] = shape;
    // A matrix's columns start on four-byte boundaries.
    const element =
      columns === 1 ? rows * size : columns * Math.ceil((rows * size) / 4) * 4;
    const view = views[accessor.bufferView];
    const stride = view.stride ?? element;
    if (
      stride < element ||
      offset + stride * (accessor.count - 1) + element > view.length
    ) {
      return null;
    }
    counts.push(accessor.count);
  }
  return counts;
};

/** A mesh's triangles and shaded vertices, or null for one three would misread. */
export const readMeshCost = (
  mesh: unknown,
  counts: readonly number[],
  materials: number,
): { triangles: number; vertices: number } | null => {
  if (!isModelRecord(mesh)) {
    return null;
  }
  const primitives = modelList(mesh.primitives);
  if (primitives.length === 0) {
    return null;
  }
  let triangles = 0;
  let vertices = 0;
  for (let i = 0; i < primitives.length; i += 1) {
    const primitive = primitives[i];
    if (!isModelRecord(primitive) || !isModelRecord(primitive.attributes)) {
      return null;
    }
    const { attributes, indices, material } = primitive;
    const mode = primitive.mode ?? 4;
    const targets = modelList(primitive.targets);
    const accessorsNamed = [
      ...Object.values(attributes),
      ...(indices === undefined ? [] : [indices]),
      ...targets.flatMap((target) =>
        isModelRecord(target) ? Object.values(target) : [null],
      ),
    ];
    if (
      typeof mode !== 'number' ||
      !TRIANGLE_MODES.has(mode) ||
      !isModelIndex(attributes.POSITION, counts.length) ||
      !accessorsNamed.every((index) => isModelIndex(index, counts.length)) ||
      (indices !== undefined && !isModelIndex(indices, counts.length)) ||
      (material !== undefined && !isModelIndex(material, materials)) ||
      targets.length > WORLD_LIMITS.modelMorphTargets
    ) {
      return null;
    }
    const shaded = counts[attributes.POSITION];
    const drawn = indices === undefined ? shaded : counts[indices];
    triangles += mode === 4 ? Math.floor(drawn / 3) : Math.max(0, drawn - 2);
    vertices += shaded * (1 + targets.length);
  }
  return { triangles, vertices };
};

/**
 * Whether the nodes are a forest whose trees are the scene's `roots`: every
 * node under one parent at most, none its own ancestor, and no root anyone's
 * child — so three builds each node exactly once. A root that is also a
 * child is built under its parent and then cloned into the scene, subtree
 * and all (GLTFLoader's `loadScene`), and a chain of such roots grows as the
 * square: 64 nodes built 2,080 meshes, 1,024 of them half a million.
 */
export const isModelForest = (
  nodes: readonly Record<string, unknown>[],
  roots: readonly number[],
): boolean => {
  const parent = new Array<number>(nodes.length).fill(-1);
  for (let i = 0; i < nodes.length; i += 1) {
    const children = modelList(nodes[i].children);
    for (let c = 0; c < children.length; c += 1) {
      const child = children[c];
      if (!isModelIndex(child, nodes.length) || parent[child] !== -1) {
        return false;
      }
      parent[child] = i;
    }
  }
  if (roots.some((root) => parent[root] !== -1)) {
    return false;
  }
  for (let i = 0; i < nodes.length; i += 1) {
    let at = parent[i];
    for (let steps = 0; at !== -1; steps += 1) {
      if (at === i || steps > nodes.length) {
        return false;
      }
      at = parent[at];
    }
  }
  return true;
};

/** The channels of the busiest clip, when every one names what it moves. */
export const readModelChannels = (
  json: Record<string, unknown>,
  counts: readonly number[],
  nodes: number,
): number | null => {
  let busiest = 0;
  const animations = modelList(json.animations);
  for (let i = 0; i < animations.length; i += 1) {
    const animation = animations[i];
    if (!isModelRecord(animation)) {
      return null;
    }
    const samplers = modelList(animation.samplers);
    const channels = modelList(animation.channels);
    const sound =
      samplers.every(
        (sampler) =>
          isModelRecord(sampler) &&
          isModelIndex(sampler.input, counts.length) &&
          isModelIndex(sampler.output, counts.length),
      ) &&
      channels.every(
        (channel) =>
          isModelRecord(channel) &&
          isModelIndex(channel.sampler, samplers.length) &&
          isModelRecord(channel.target) &&
          (channel.target.node === undefined ||
            isModelIndex(channel.target.node, nodes)),
      );
    if (!sound) {
      return null;
    }
    busiest = Math.max(busiest, channels.length);
  }
  return busiest > WORLD_LIMITS.modelChannels ? null : busiest;
};
