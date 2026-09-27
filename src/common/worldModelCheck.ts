/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS } from './sceneWorld';
import { MODEL_IMAGE_TYPES, modelImageSize } from './worldModelImages';
import {
  isModelForest,
  isModelIndex,
  isModelRecord,
  modelList,
  readAccessorCounts,
  readMeshCost,
  readModelChannels,
  readModelViews,
  type IModelView,
} from './worldModelParts';

/**
 * A model a world may carry — a binary glTF — read from its own table of
 * contents before anything parses it, and what it costs a frame. The world's
 * reader (`sceneWorldRead.ts`), the Studio, the engine
 * (`renderer/graph/world/worldModels.ts`) and the server all use this, so all
 * four refuse the same models and agree on what each one asks of a GPU.
 *
 * A scene fetches nothing (`sceneArtwork.ts` holds artwork to the same rule)
 * and every listener's machine draws it, so a model is read against what
 * three's `GLTFLoader` does with a file, not what the specification says a
 * file should hold. Each rule here closes something that loader does:
 *
 *  - it walks every chunk and keeps the LAST JSON chunk, so a file whose
 *    first table of contents was harmless and whose second named a URL
 *    passed here and was fetched there. Only one JSON chunk and at most one
 *    binary chunk, filling the file exactly, are read.
 *  - a plugin acts on an object's own `extensions` whether or not the file
 *    lists it in `extensionsUsed`: `EXT_mesh_gpu_instancing` drew a mesh a
 *    million times with nothing declared. Every `extensions` anywhere may
 *    name only what the engine was built for, and nothing anywhere may carry
 *    a `uri`.
 *  - what it allocates must lie inside the file (`worldModelParts.ts`), and
 *    an image is held to the size its own header says it decodes to
 *    (`worldModelImages.ts`).
 *  - its lights would be the world's lights past `WORLD_LIMITS.lights`, so
 *    a model brings none.
 */

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

/**
 * Extensions three reads with nothing loaded from a file. Compressed meshes
 * and textures need decoders fetched from somewhere, and a decoder that
 * cannot load leaves a model with no geometry and nothing saying so.
 */
const MODEL_EXTENSIONS = new Set([
  'KHR_materials_emissive_strength',
  'KHR_materials_clearcoat',
  'KHR_materials_transmission',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_materials_iridescence',
  'KHR_materials_volume',
  'KHR_materials_unlit',
  'KHR_materials_anisotropy',
  'KHR_materials_dispersion',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
]);

/** What a model asks of the GPU wherever it is placed. */
export interface IModelCost {
  /** Triangles across every mesh of every node, drawn once. */
  triangles: number;
  /** Vertices shaded a frame, each morph target counting its mesh again. */
  vertices: number;
  /** Pixels of every embedded image, decoded. */
  pixels: number;
  /** Channels the busiest clip moves a frame: the work of playing it. */
  channels: number;
  /** A material that has three draw the world again, behind the glass. */
  transmission: boolean;
}

interface IGlb {
  json: Record<string, unknown>;
  /** Where the binary chunk's bytes start in the file, and how many. */
  bodyStart: number;
  bodyLength: number;
}

/** The table of contents, when the container is exactly what three reads. */
const readGlb = (bytes: Uint8Array): IGlb | null => {
  if (bytes.byteLength < 20) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== GLB_MAGIC ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  ) {
    return null;
  }
  const jsonLength = view.getUint32(12, true);
  const jsonEnd = 20 + jsonLength;
  if (
    view.getUint32(16, true) !== GLB_JSON_CHUNK ||
    jsonEnd > bytes.byteLength
  ) {
    return null;
  }
  let bodyStart = jsonEnd;
  let bodyLength = 0;
  if (jsonEnd < bytes.byteLength) {
    if (jsonEnd + 8 > bytes.byteLength) {
      return null;
    }
    bodyStart = jsonEnd + 8;
    bodyLength = view.getUint32(jsonEnd, true);
    if (
      view.getUint32(jsonEnd + 4, true) !== GLB_BIN_CHUNK ||
      bodyStart + bodyLength !== bytes.byteLength
    ) {
      return null;
    }
  }
  try {
    const json: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(20, jsonEnd),
      ),
    );
    return isModelRecord(json) ? { json, bodyStart, bodyLength } : null;
  } catch {
    return null;
  }
};

/**
 * Nothing anywhere names a file, and every `extensions` names only what the
 * engine reads. Walked without recursion: the JSON is somebody else's, and a
 * few megabytes of nested brackets would take the stack down.
 */
const namesNothingOutside = (json: Record<string, unknown>): boolean => {
  const pending: unknown[] = [json];
  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        pending.push(value[i]);
      }
    } else if (isModelRecord(value)) {
      if (Object.prototype.hasOwnProperty.call(value, 'uri')) {
        return false;
      }
      const { extensions } = value;
      if (
        extensions !== undefined &&
        (!isModelRecord(extensions) ||
          Object.keys(extensions).some((name) => !MODEL_EXTENSIONS.has(name)))
      ) {
        return false;
      }
      const fields = Object.values(value);
      for (let i = 0; i < fields.length; i += 1) {
        pending.push(fields[i]);
      }
    }
  }
  return ['extensionsUsed', 'extensionsRequired'].every((key) =>
    modelList(json[key]).every(
      (name) => typeof name === 'string' && MODEL_EXTENSIONS.has(name),
    ),
  );
};

/** Pixels of every image, each embedded and no larger than a side allows. */
const readImagePixels = (
  json: Record<string, unknown>,
  views: readonly IModelView[],
  bytes: Uint8Array,
  bodyStart: number,
): number | null => {
  let pixels = 0;
  const images = modelList(json.images);
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (
      !isModelRecord(image) ||
      !isModelIndex(image.bufferView, views.length) ||
      typeof image.mimeType !== 'string' ||
      !MODEL_IMAGE_TYPES.has(image.mimeType)
    ) {
      return null;
    }
    const view = views[image.bufferView];
    const start = bodyStart + view.offset;
    const size = modelImageSize(
      bytes.subarray(start, start + view.length),
      image.mimeType,
    );
    if (
      !size ||
      size[0] < 1 ||
      size[1] < 1 ||
      size[0] > WORLD_LIMITS.modelImageSide ||
      size[1] > WORLD_LIMITS.modelImageSide
    ) {
      return null;
    }
    pixels += size[0] * size[1];
  }
  return pixels;
};

/** Every skin's joints are nodes, every texture's source an image. */
const referencesSound = (
  json: Record<string, unknown>,
  nodes: number,
  accessors: number,
): boolean => {
  const images = modelList(json.images).length;
  return (
    modelList(json.skins).every(
      (skin) =>
        isModelRecord(skin) &&
        modelList(skin.joints).length > 0 &&
        modelList(skin.joints).every((joint) => isModelIndex(joint, nodes)) &&
        (skin.inverseBindMatrices === undefined ||
          isModelIndex(skin.inverseBindMatrices, accessors)),
    ) &&
    modelList(json.textures).every(
      (texture) =>
        isModelRecord(texture) &&
        (texture.source === undefined || isModelIndex(texture.source, images)),
    )
  );
};

/** A glTF 2 file: three refuses any other major version outright. */
const isGltfTwo = (json: Record<string, unknown>) =>
  isModelRecord(json.asset) &&
  typeof json.asset.version === 'string' &&
  /^2\.\d+$/.test(json.asset.version);

/**
 * What the model costs, or null when it is not one this version reads: not a
 * binary glTF three would read the same way, reaching outside itself, asking
 * for memory it does not carry, or past a bound on its own.
 */
export const readModelCost = (bytes: Uint8Array): IModelCost | null => {
  const glb = readGlb(bytes);
  if (!glb || !isGltfTwo(glb.json) || !namesNothingOutside(glb.json)) {
    return null;
  }
  const { json } = glb;
  const views = readModelViews(json, glb.bodyLength);
  const counts = views ? readAccessorCounts(json, views) : null;
  const scenes = modelList(json.scenes);
  const rawNodes = modelList(json.nodes);
  const materials = modelList(json.materials);
  if (
    !views ||
    !counts ||
    scenes.length !== 1 ||
    (json.scene !== undefined && json.scene !== 0) ||
    rawNodes.length > WORLD_LIMITS.modelNodes ||
    materials.length > WORLD_LIMITS.materials ||
    !rawNodes.every(isModelRecord)
  ) {
    return null;
  }
  const nodes = rawNodes as Record<string, unknown>[];
  const [scene] = scenes;
  const roots = isModelRecord(scene) ? modelList(scene.nodes) : [null];
  const meshes = modelList(json.meshes).map((mesh) =>
    readMeshCost(mesh, counts, materials.length),
  );
  const skins = modelList(json.skins).length;
  if (
    !referencesSound(json, nodes.length, counts.length) ||
    !roots.every((root) => isModelIndex(root, nodes.length)) ||
    new Set(roots).size !== roots.length ||
    !isModelForest(nodes, roots) ||
    !nodes.every(
      (node) =>
        (node.mesh === undefined || isModelIndex(node.mesh, meshes.length)) &&
        (node.skin === undefined || isModelIndex(node.skin, skins)),
    )
  ) {
    return null;
  }
  // Every node three builds is built once (a forest, one scene), so the
  // model costs what its nodes' meshes cost, each as often as it is placed.
  let triangles = 0;
  let vertices = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const { mesh } = nodes[i];
    if (mesh !== undefined) {
      const cost = meshes[mesh as number];
      if (!cost) {
        return null;
      }
      triangles += cost.triangles;
      vertices += cost.vertices;
    }
  }
  const pixels = readImagePixels(json, views, bytes, glb.bodyStart);
  const channels = readModelChannels(json, counts, nodes.length);
  if (
    pixels === null ||
    channels === null ||
    triangles > WORLD_LIMITS.modelTriangles ||
    pixels > WORLD_LIMITS.modelImagePixels
  ) {
    return null;
  }
  return {
    triangles,
    vertices,
    pixels,
    channels,
    transmission: materials.some(
      (material) =>
        isModelRecord(material) &&
        isModelRecord(material.extensions) &&
        material.extensions.KHR_materials_transmission !== undefined,
    ),
  };
};

/** Whether everything the model needs is inside it, and readable here. */
const isSelfContainedModel = (bytes: Uint8Array): boolean =>
  readModelCost(bytes) !== null;

export default isSelfContainedModel;
