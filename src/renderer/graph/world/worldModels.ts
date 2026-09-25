/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Texture, type AnimationClip, type Group, type Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_LIMITS, type IWorldModel } from 'common/sceneWorld';
import isSelfContainedModel from 'common/worldModelCheck';
import { sceneArtworkBytes } from '../sceneArtwork';

/**
 * A world's models: binary glTF, carried inside the signed pack.
 *
 * Nothing in one may point anywhere: a model is read only after its own
 * table of contents has been checked (`common/worldModelCheck.ts`).
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

const triangles = (scene: Group): number => {
  let total = 0;
  scene.traverse((object) => {
    const mesh = object as Partial<Mesh>;
    if (mesh.isMesh && mesh.geometry) {
      const { index } = mesh.geometry;
      const position = mesh.geometry.getAttribute('position');
      total += Math.floor((index ? index.count : position.count) / 3);
    }
  });
  return total;
};

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
          const made = new Texture(bitmap);
          made.userData.mimeType = type;
          made.needsUpdate = true;
          return made;
        });
      decoded.set(sourceIndex, texture);
      return texture;
    };
    Object.assign(parser, { loadImageSource: decode });
    return { name: 'FLUIDEQ_embedded_images' };
  });
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  return { scene: gltf.scene, animations: gltf.animations };
};

/**
 * Every model that reads, by id, and a line for each that did not — refused
 * by the check above, broken, or past the triangle budget with the ones
 * before it. A model left out draws nothing where it was placed; the lines
 * are for the scene's author, in the Studio.
 */
export const parseWorldModels = async (
  models: Readonly<Record<string, IWorldModel>>,
): Promise<{
  parsed: Record<string, IWorldModelAsset>;
  problems: string[];
}> => {
  const parsed: Record<string, IWorldModelAsset> = {};
  const problems: string[] = [];
  let budget: number = WORLD_LIMITS.modelTriangles;
  const ids = Object.keys(models);
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const bytes = sceneArtworkBytes(models[id]);
    if (!isSelfContainedModel(bytes)) {
      problems.push(
        `model "${id}" is not a self-contained binary glTF this version reads`,
      );
    } else {
      try {
        const asset = await parseModel(bytes);
        const count = triangles(asset.scene);
        if (count <= budget) {
          budget -= count;
          parsed[id] = asset;
        } else {
          problems.push(`model "${id}" is past the triangle budget`);
        }
      } catch (error) {
        problems.push(`model "${id}" could not be read: ${String(error)}`);
      }
    }
  }
  return { parsed, problems };
};
