/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Cover Flow scene's pictures on the graphics card: one texture per
 * cover within reach of where the row stands, decoded a few at a time,
 * nearest first, uploaded a few per frame, and given back the moment a
 * cover leaves the window.
 *
 * A cover near the centre wears the 320 picture and the rest the medium one
 * (`coverFlowArt.ts`); a cover that comes towards the centre keeps the
 * smaller picture on until the larger one has landed, so nothing blinks.
 */
import * as THREE from 'three';
import {
  type ICoverFlowArt,
  type ICoverFlowArtColours,
  type ICoverFlowArtRequest,
  type TCoverFlowArtSize,
  loadCoverFlowArt,
  releaseCoverFlowArt,
} from './coverFlowArt';

/** Pictures decoded at once; the rest wait their turn. */
const DECODES_AT_ONCE = 4;
/** Covers this close to where the row comes to rest take the large picture. */
const NEAR = 2;

export interface IArtEntry {
  request: ICoverFlowArtRequest;
  texture?: THREE.Texture;
  size?: TCoverFlowArtSize;
  loading?: TCoverFlowArtSize;
  ready?: { art: ICoverFlowArt; size: TCoverFlowArtSize };
  glow?: THREE.Color;
}

/** The same picture for every cover that would paint the same. */
export const artKeyOf = (slot: ICoverFlowArtRequest): string =>
  `${slot.artId ?? ''}|${slot.label}|${slot.isFolder ? 1 : 0}|${slot.isPending ? 1 : 0}`;

export interface ICoverFlowArtCache {
  /** The entry for a cover `distance` from where the row rests, asking for
   * the picture it should wear if it has not got it. */
  entryFor: (slot: ICoverFlowArtRequest, distance: number) => IArtEntry;
  /** Turns a landed picture into the entry's texture. */
  upload: (entry: IArtEntry) => void;
  /** The light a cover throws, once its picture has landed. */
  glowOf: (slot: ICoverFlowArtRequest) => THREE.Color | undefined;
  hasTexture: (slot: ICoverFlowArtRequest) => boolean;
  /** Before a frame's covers are asked for: the queue is rebuilt, nearest
   * first, every frame. */
  beginFrame: () => void;
  /** After: everything not asked for is given back, and the decodes run. */
  endFrame: (kept: ReadonlySet<string>) => void;
  /** A picture has landed and is waiting to be uploaded. */
  isWaiting: () => boolean;
  dispose: () => void;
}

export const createCoverFlowArtCache = (options: {
  anisotropy: number;
  colours: ICoverFlowArtColours;
  /** A picture has landed: the scene wants a frame. */
  onReady: () => void;
}): ICoverFlowArtCache => {
  const art = new Map<string, IArtEntry>();
  const queue: { key: string; size: TCoverFlowArtSize }[] = [];
  let decoding = 0;
  let isDisposed = false;

  const release = (entry: IArtEntry) => {
    entry.texture?.dispose();
    if (entry.ready) {
      releaseCoverFlowArt(entry.ready.art);
    }
    entry.loading = undefined;
  };

  /** Decodes one cover's picture; `pump` starts the next as each lands. */
  const decode = (key: string, size: TCoverFlowArtSize, entry: IArtEntry) => {
    entry.loading = size;
    decoding += 1;
    loadCoverFlowArt(entry.request, size, options.colours)
      .then((loaded) => {
        decoding -= 1;
        if (isDisposed || art.get(key) !== entry) {
          releaseCoverFlowArt(loaded);
        } else {
          if (entry.ready) {
            releaseCoverFlowArt(entry.ready.art);
          }
          entry.ready = { art: loaded, size };
          entry.loading = undefined;
          options.onReady();
        }
        pump();
        return undefined;
      })
      .catch((error: unknown) => {
        decoding -= 1;
        entry.loading = undefined;
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the cover stays an empty sleeve
        console.error('A Cover Flow picture could not be painted', error);
        pump();
      });
  };

  function pump() {
    while (!isDisposed && decoding < DECODES_AT_ONCE && queue.length > 0) {
      const next = queue.shift();
      const entry = next === undefined ? undefined : art.get(next.key);
      if (next !== undefined && entry !== undefined && !entry.loading) {
        decode(next.key, next.size, entry);
      }
    }
  }

  return {
    entryFor: (slot, distance) => {
      const key = artKeyOf(slot);
      let entry = art.get(key);
      if (!entry) {
        entry = { request: slot };
        art.set(key, entry);
      }
      const size: TCoverFlowArtSize = distance <= NEAR ? 'near' : 'far';
      const best = entry.ready?.size ?? entry.size;
      const has = best === 'near' || best === size;
      // One decode per cover at a time; a far picture still on its way is
      // followed by the near one once it lands, never raced by it.
      if (!has && !entry.loading) {
        queue.push({ key, size });
      }
      return entry;
    },
    upload: (entry) => {
      const { ready } = entry;
      if (!ready) {
        return;
      }
      const texture = new THREE.Texture(ready.art.source);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = options.anisotropy;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      const { art: picture } = ready;
      // On the graphics card the pixels are no longer needed here; a lost
      // context builds the scene again from the start.
      texture.onUpdate = () => releaseCoverFlowArt(picture);
      entry.texture?.dispose();
      entry.texture = texture;
      entry.size = ready.size;
      const [r, g, b] = picture.glow;
      entry.glow = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
      entry.ready = undefined;
    },
    glowOf: (slot) => art.get(artKeyOf(slot))?.glow,
    hasTexture: (slot) => art.get(artKeyOf(slot))?.texture !== undefined,
    beginFrame: () => {
      queue.length = 0;
    },
    endFrame: (kept) => {
      art.forEach((entry, key) => {
        if (!kept.has(key)) {
          release(entry);
          art.delete(key);
        }
      });
      pump();
    },
    isWaiting: () =>
      Array.from(art.values()).some((entry) => entry.ready !== undefined),
    dispose: () => {
      isDisposed = true;
      art.forEach(release);
      art.clear();
      queue.length = 0;
    },
  };
};
