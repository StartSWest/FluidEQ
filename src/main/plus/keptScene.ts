/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../common/memberSceneFile';
import {
  isScenePackEnvelope,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { download, type IAuthorised } from './galleryApi';

/**
 * A member scene its maker unpublished, read from the copy FluidEQ keeps for
 * whoever got it (premium 0103, Ivan 2026-11-12: "the users that buys them
 * keep them for good"). The server copies what the gallery served to the
 * maker's folder before the gallery row goes, and lets the scene's owners
 * alone read it; nothing here decides who may.
 */

/** Where the kept copy lives, as the publishing service writes it. */
export const keptScenePath = (
  authorId: string,
  sceneId: string,
  file: 'scene.json' | 'picture.webp',
) => `${authorId}/${sceneId}/unpublished/${file}`;

/**
 * The kept scene file, unverified: the caller checks the signature and that
 * it is the scene asked for, as for a gallery download. `version` names the
 * copy expected, so the storage CDN's copy of an earlier unpublish is not
 * handed back for a later one.
 */
export const fetchKeptEnvelope = async (
  auth: IAuthorised,
  authorId: string,
  sceneId: string,
  version: number,
): Promise<IScenePackEnvelope | undefined> => {
  const bytes = await download(
    auth,
    keptScenePath(authorId, sceneId, 'scene.json'),
    MAX_MEMBER_SCENE_FILE_BYTES,
    String(version),
  );
  if (!bytes) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isScenePackEnvelope(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};
