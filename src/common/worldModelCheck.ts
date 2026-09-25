/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a binary glTF carries everything it needs inside itself, read from
 * its own table of contents before anything parses it: the Studio's check on
 * a model a member added, and the engine's before it loads one
 * (`renderer/graph/world/worldModels.ts`), so both refuse the same models.
 *
 * A glTF can name its buffers and images by URL, and a scene fetches nothing
 * (`sceneArtwork.ts` holds artwork to the same rule): one embedded buffer,
 * every image a slice of it, and no extension the engine has not been built
 * for — compressed meshes and textures need decoders loaded from files, and
 * a decoder that cannot load leaves a model that silently has no geometry.
 */

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

const READABLE_EXTENSIONS = new Set([
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
  'KHR_lights_punctual',
]);

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const isModelRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const listOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/** The glTF's table of contents, if the container is one this can read. */
const readContents = (bytes: Uint8Array): Record<string, unknown> | null => {
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
  const length = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== JSON_CHUNK ||
    20 + length > bytes.byteLength
  ) {
    return null;
  }
  try {
    const contents: unknown = JSON.parse(
      new TextDecoder().decode(bytes.subarray(20, 20 + length)),
    );
    return isModelRecord(contents) ? contents : null;
  } catch {
    return null;
  }
};

/** Whether everything the model needs is inside it, and readable here. */
const isSelfContainedModel = (bytes: Uint8Array): boolean => {
  const contents = readContents(bytes);
  if (!contents) {
    return false;
  }
  const buffers = listOf(contents.buffers);
  if (
    buffers.length > 1 ||
    buffers.some((buffer) => !isModelRecord(buffer) || buffer.uri !== undefined)
  ) {
    return false;
  }
  const imagesEmbedded = listOf(contents.images).every(
    (image) =>
      isModelRecord(image) &&
      image.uri === undefined &&
      typeof image.bufferView === 'number' &&
      typeof image.mimeType === 'string' &&
      IMAGE_TYPES.has(image.mimeType),
  );
  const required = listOf(contents.extensionsRequired);
  return (
    imagesEmbedded &&
    required.every(
      (name) => typeof name === 'string' && READABLE_EXTENSIONS.has(name),
    )
  );
};

export default isSelfContainedModel;
