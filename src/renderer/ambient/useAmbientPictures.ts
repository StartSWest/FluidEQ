/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IAmbientElement } from 'common/sceneAmbient';
import type { ISceneArtwork } from 'common/sceneArtwork';
import { cutAmbientPictures, type TAmbientPictures } from './ambientPictures';

const NO_PICTURES: TAmbientPictures = new Map();

/**
 * The poses of `elements`' pictures, cut from the scene's `artwork` once per
 * scene built, for what shows them outside the window's own layer (the
 * Studio's element icons). Empty until cut, and for a scene with none; a
 * cut still running when the scene changes is abandoned.
 */
export default function useAmbientPictures(
  elements: readonly IAmbientElement[] | undefined,
  artwork: ISceneArtwork | undefined,
): TAmbientPictures {
  const [pictures, setPictures] = useState<TAmbientPictures>(NO_PICTURES);
  useEffect(() => {
    if (!elements?.some((element) => element.shape === 'picture')) {
      setPictures(NO_PICTURES);
      return undefined;
    }
    const controller = new AbortController();
    cutAmbientPictures(artwork, elements, controller.signal)
      .then(setPictures)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          // eslint-disable-next-line no-console -- the only trace of pictures that could not be cut; the icons draw the other elements without them
          console.error('Could not cut the scene ambient pictures', error);
        }
      });
    return () => controller.abort();
  }, [elements, artwork]);
  return pictures;
}
