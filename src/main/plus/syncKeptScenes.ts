/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseMemberLookId } from '../../common/memberScenes';
import type { IUnpublishedScene } from '../../common/sceneStore';
import { isLaterSceneVersion } from '../../common/sceneVersionNote';
import { openMemberEnvelope } from '../memberScenes/sharing';
import type { IMemberSceneStore } from '../memberScenes/store';
import type { IGalleryAccess } from './galleryAccess';
import type { IAuthorised } from './galleryApi';
import { fetchKeptEnvelope } from './keptScene';
import type { ISceneOwnership } from './sceneOwnership';

interface IDependencies {
  access: IGalleryAccess;
  ownership: Pick<ISceneOwnership, 'known' | 'subscribe'>;
  store: IMemberSceneStore;
  announce: () => void;
  logger?: { warn(message: string): void };
  /** The kept copy's reader; the real one unless a test stands in. */
  fetchKept?: (
    auth: IAuthorised,
    authorId: string,
    sceneId: string,
    version: number,
  ) => ReturnType<typeof fetchKeptEnvelope>;
}

/**
 * Brings onto this computer the scenes this account owns that their makers
 * unpublished (premium 0103). Out of the gallery there is no card to add one
 * from, so a new computer or a reinstall would never get it back; the store
 * names them (`unpublished`), and each one not here, or here at an older
 * version, is downloaded from the copy kept for its owners. Verified as a
 * gallery download is: its own signature, the author and scene asked for.
 *
 * Event-driven, never timed: every change of the store (a sign-in, a
 * refresh at a come-back) runs it, one scene after another. A scene tried at
 * a version this session is not asked again for that version unless the try
 * could not reach the server.
 */
export const createKeptSceneSync = ({
  access,
  ownership,
  store,
  announce,
  logger,
  fetchKept = fetchKeptEnvelope,
}: IDependencies) => {
  const settled = new Set<string>();
  let queue = Promise.resolve();

  const syncOne = async ({ lookId, version }: IUnpublishedScene) => {
    const ref = parseMemberLookId(lookId);
    const me = access.accountId();
    // A maker's own scene is theirs in their project, never a kept copy.
    if (!ref || !me || ref.authorId === me) {
      return;
    }
    const key = `${me}:${lookId}@${version}`;
    if (settled.has(key)) {
      return;
    }
    const eligible = () =>
      access.accountId() === me &&
      access.owns(lookId) &&
      !store.isBlocked(ref.authorId, ref.packId) &&
      // Another account's own editable copy is never replaced by this one's.
      !store.list().some((entry) => entry.lookId === lookId && entry.own);
    const later = (next: number) =>
      isLaterSceneVersion(
        next,
        store.newest(ref.authorId, ref.packId)?.version,
      );
    if (!eligible() || !later(version)) {
      settled.add(key);
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== me) {
      // Signed out on the way: asked again at the next store change.
      return;
    }
    const envelope = await fetchKept(auth, ref.authorId, ref.packId, version);
    const opened = envelope ? openMemberEnvelope(envelope) : undefined;
    if (!envelope || !opened) {
      // Not there yet, or not readable: the next store change asks again.
      return;
    }
    settled.add(key);
    if (
      opened.author.id !== ref.authorId ||
      opened.pack.id !== ref.packId ||
      !later(opened.pack.version) ||
      !eligible()
    ) {
      return;
    }
    store.saveImported(envelope);
    announce();
  };

  const run = () => {
    const scenes = ownership.known()?.unpublished ?? [];
    queue = queue.then(() =>
      scenes.reduce(async (previous, scene) => {
        await previous;
        try {
          await syncOne(scene);
        } catch (error) {
          logger?.warn(
            `Could not bring back unpublished scene ${scene.lookId}: ${String(error)}`,
          );
        }
      }, Promise.resolve()),
    );
    return queue;
  };

  const off = ownership.subscribe(() => {
    run().catch(() => undefined);
  });
  return { run, dispose: off };
};
