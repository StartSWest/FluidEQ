/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Texture, type AnimationClip, type Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_LIMITS, type IWorldModel } from 'common/sceneWorld';
import isSelfContainedModel from 'common/worldModelCheck';
import type { TWorldNote } from 'common/worldNotes';
import { sceneArtworkBytes } from '../sceneArtwork';

/**
 * A world's models: binary glTF, carried inside the signed pack.
 *
 * Nothing in one may point anywhere: a model is read only after its own
 * table of contents has been checked (`common/worldModelCheck.ts`), which is
 * also what held it to the world's triangles and image pixels when the world
 * was read. The loader is held to the same thing again here, because it is
 * the loader that would fetch: a buffer is only ever the file's own body.
 *
 * Images are decoded straight from their bytes, never through a URL. Three's
 * loader makes a `blob:` URL for each and fetches it, and the wallpaper's
 * window, whose policy allows fetching nothing but its own files, refused
 * every one: the model drew untextured on the desktop and textured in the
 * app. `createImageBitmap` on the bytes needs no URL at all.
 */

export interface IWorldModelAsset {
  scene: Group;
  animations: AnimationClip[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entries = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const parseModel = async (
  bytes: Uint8Array<ArrayBuffer>,
): Promise<IWorldModelAsset> => {
  const loader = new GLTFLoader();
  loader.register((parser) => {
    const decoded = new Map<number, Promise<Texture>>();
    const decode = (sourceIndex: number): Promise<Texture> => {
      const known = decoded.get(sourceIndex);
      if (known) {
        return known.then((texture) => texture.clone());
      }
      const image: unknown = entries(parser.json.images)[sourceIndex];
      if (!isRecord(image) || typeof image.bufferView !== 'number') {
        return Promise.reject(new Error('model image is not embedded'));
      }
      const type = typeof image.mimeType === 'string' ? image.mimeType : '';
      const texture = parser
        .getDependency('bufferView', image.bufferView)
        .then((view: ArrayBuffer) =>
          createImageBitmap(new Blob([view], { type }), {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
          }),
        )
        .then((bitmap) => {
          // The check read this size from the image's own header; a decoder
          // that disagreed with it would not get to keep the difference.
          if (
            bitmap.width > WORLD_LIMITS.modelImageSide ||
            bitmap.height > WORLD_LIMITS.modelImageSide
          ) {
            bitmap.close();
            throw new Error('model image is larger than its header says');
          }
          const made = new Texture(bitmap);
          made.userData.mimeType = type;
          made.needsUpdate = true;
          return made;
        });
      decoded.set(sourceIndex, texture);
      return texture;
    };
    const loadBuffer = parser.loadBuffer.bind(parser);
    const ownBody = (index: number): Promise<ArrayBuffer> => {
      const buffer: unknown = entries(parser.json.buffers)[index];
      return index === 0 && isRecord(buffer) && buffer.uri === undefined
        ? loadBuffer(index)
        : Promise.reject(new Error('model buffer is not embedded'));
    };
    Object.assign(parser, { loadImageSource: decode, loadBuffer: ownBody });
    return { name: 'FLUIDEQ_embedded_only' };
  });
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  return { scene: gltf.scene, animations: gltf.animations };
};

/**
 * Every model that reads, by id, and a note for each that did not — refused
 * by the check above or broken. A model left out draws nothing where it was
 * placed; the notes are for the scene's author, in the Studio.
 */
export const parseWorldModels = async (
  models: Readonly<Record<string, IWorldModel>>,
): Promise<{
  parsed: Record<string, IWorldModelAsset>;
  notes: TWorldNote[];
}> => {
  const parsed: Record<string, IWorldModelAsset> = {};
  const notes: TWorldNote[] = [];
  const ids = Object.keys(models);
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const bytes = sceneArtworkBytes(models[id]);
    if (!isSelfContainedModel(bytes)) {
      notes.push({ code: 'model-refused', model: id });
    } else {
      try {
        parsed[id] = await parseModel(bytes);
      } catch (error) {
        notes.push({
          code: 'model-unreadable',
          model: id,
          detail: String(error),
        });
      }
    }
  }
  return { parsed, notes };
};
