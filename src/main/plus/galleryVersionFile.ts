/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../common/memberSceneFile';
import {
  isScenePackEnvelope,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { download, rpc } from './galleryApi';
import type { IGalleryAuth } from './galleryAccess';
import { MAX_ENVELOPE_BYTES } from './officialGallery';

/**
 * One of the versions the server keeps of a scene (fluideq-premium 0100: the
 * last ten of each), downloaded for an owner who asked to save it. The
 * database says where it is only to an account that owns the scene while it
 * is in the gallery, and the bucket serves it only to the same account, so
 * nothing here decides who may have it. Nothing here trusts it either: the
 * path must be the one this version is kept at, and the file is returned only
 * as an envelope for the store to verify.
 *
 * A download happens only on that explicit ask, never to list versions: the
 * list is numbers and dates (`scene_version_history`), and the server's free
 * plan counts every byte that leaves it.
 */

export type TVersionFileOutcome =
  | { ok: true; envelope: IScenePackEnvelope }
  | {
      ok: false;
      reason: 'signed-out' | 'gone' | 'offline' | 'failed' | 'cancelled';
    };

/** Where the server keeps `version` of a scene: the one path it may answer. */
export const versionFilePath = (
  authorId: string,
  sceneId: string,
  version: number,
) => `${authorId}/${sceneId}/versions/${version}.scene.json`;

export const fetchVersionFile = async (
  auth: IGalleryAuth,
  authorId: string,
  sceneId: string,
  version: number,
  signal: AbortSignal,
): Promise<TVersionFileOutcome> => {
  const cancelled = { ok: false, reason: 'cancelled' } as const;
  let response: Response;
  try {
    response = await rpc(
      auth,
      'scene_version_file',
      { p_author: authorId, p_scene: sceneId, p_version: version },
      signal,
    );
  } catch {
    return signal.aborted ? cancelled : { ok: false, reason: 'offline' };
  }
  if (response.status === 401) {
    return { ok: false, reason: 'signed-out' };
  }
  // A server from before it kept versions has no such question.
  if (response.status === 404) {
    return { ok: false, reason: 'gone' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'failed' };
  }
  let path: unknown;
  try {
    path = await response.json();
  } catch {
    return signal.aborted ? cancelled : { ok: false, reason: 'failed' };
  }
  // Nothing: let go since the list was read, or no longer this account's to
  // read (the caller asked about ownership first).
  if (path === null) {
    return { ok: false, reason: 'gone' };
  }
  if (path !== versionFilePath(authorId, sceneId, version)) {
    return { ok: false, reason: 'failed' };
  }
  const bytes = await download(
    auth,
    path,
    authorId === FLUIDEQ_CREATOR_ID
      ? MAX_ENVELOPE_BYTES
      : MAX_MEMBER_SCENE_FILE_BYTES,
    undefined,
    signal,
  );
  if (signal.aborted) {
    return cancelled;
  }
  if (!bytes) {
    return { ok: false, reason: 'failed' };
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isScenePackEnvelope(parsed)
      ? { ok: true, envelope: parsed }
      : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
};
