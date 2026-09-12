import type { IGalleryScene } from '../../common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import { openMemberEnvelope } from '../memberScenes/sharing';
import type { IMemberSceneStore } from '../memberScenes/store';
import type { IScenePackStore } from '../scenePackStore';
import type { IGalleryAccess } from './galleryAccess';
import { fetchEnvelope } from './galleryApi';
import { fetchOfficialScene } from './officialGallery';

interface IDependencies {
  access: IGalleryAccess;
  store: IMemberSceneStore;
  officialStore?: IScenePackStore;
  announce: () => void;
  announceOfficial?: () => void;
  logger?: { warn(message: string): void };
}

/** Event-driven: only installed scenes, once per published revision per session.
 * Removal during a download wins. Missing publications keep their local copies.
 * Every download is verified against its own signing key and expected author/id.
 */
export const createGallerySceneSync = ({
  access,
  store,
  officialStore,
  announce,
  announceOfficial,
  logger,
}: IDependencies) => {
  const checked = new Map<string, string>();
  let queue = Promise.resolve();
  const syncOne = async (scene: IGalleryScene) => {
    const me = access.accountId();
    if (!me || !access.entitled()) {
      return;
    }
    const official = scene.authorId === FLUIDEQ_CREATOR_ID;
    const load = () =>
      official
        ? officialStore?.load(scene.sceneId)
        : store.load(scene.authorId, scene.sceneId);
    const current = load();
    if (!current || store.isBlocked(scene.authorId, scene.sceneId)) {
      return;
    }
    // Another account's own editable copies are never part of this account.
    if (
      !official &&
      scene.authorId !== me &&
      store.list().some((entry) => entry.lookId === scene.lookId && entry.own)
    ) {
      return;
    }
    const stamp = `${me}:${scene.updatedAt}:${scene.version}`;
    if (checked.get(scene.lookId) === stamp) {
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== me) {
      return;
    }
    const stillEligible = () =>
      access.accountId() === me &&
      access.entitled() &&
      !!load() &&
      !store.isBlocked(scene.authorId, scene.sceneId);
    if (official) {
      const next = await fetchOfficialScene(auth, scene.sceneId);
      if (!next || !stillEligible() || next.pack.version < current.version) {
        return;
      }
      const changed = officialStore?.adopt(
        [
          {
            id: next.pack.id,
            version: next.pack.version,
            envelope: next.envelope,
          },
        ],
        true,
      );
      if (changed) {
        announceOfficial?.();
      }
    } else {
      const envelope = await fetchEnvelope(auth, scene.authorId, scene.sceneId);
      const next = envelope ? openMemberEnvelope(envelope) : undefined;
      if (
        !next ||
        !envelope ||
        next.author.id !== scene.authorId ||
        next.pack.id !== scene.sceneId ||
        next.pack.version < current.version ||
        !stillEligible()
      ) {
        return;
      }
      if (JSON.stringify(load()) !== JSON.stringify(next.pack)) {
        if (scene.authorId === me) {
          store.save(me, next.pack);
        } else {
          store.saveImported(envelope);
        }
        announce();
      }
    }
    checked.set(scene.lookId, stamp);
  };
  return (scenes: readonly IGalleryScene[]) => {
    queue = queue.then(async () => {
      // Sequential downloads bound memory even on a page of large artwork packs.
      await scenes.reduce(async (previous, scene) => {
        await previous;
        try {
          await syncOne(scene);
        } catch (error) {
          logger?.warn(
            `Could not update installed scene ${scene.sceneId}: ${String(error)}`,
          );
        }
      }, Promise.resolve());
      return undefined;
    });
    return queue;
  };
};
