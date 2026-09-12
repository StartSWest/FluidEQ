import { useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene, TReportReason } from 'common/plusGallery';
import type { TGalleryAddOutcome } from 'main/ipc/plusGallery';
import { requestAccountPanel } from '../account/accountPanel';
import {
  likeMemberSceneLook,
  refreshMemberScenes,
} from '../utils/memberScenes';
import { refreshScenePacks } from '../utils/scenePacks';
import { patchGalleryScene } from './galleryStore';

/**
 * What a member does to a scene in the gallery — add it, like it, report it —
 * and the one line the gallery says back.
 *
 * The line is shared by every page of the gallery, so an Add pressed on a
 * card and one pressed on the scene's page answer in the same place, and a
 * new action replaces the last answer rather than stacking under it.
 */

export interface IGalleryNotice {
  ok: boolean;
  key: TranslationKey;
  vars?: Record<string, string>;
}

let notice: IGalleryNotice | undefined;
const adding = new Set<string>();
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useGalleryNotice = () =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );

export const setGalleryNotice = (next: IGalleryNotice | undefined) => {
  notice = next;
  notify();
};

let addingSnapshot: ReadonlySet<string> = new Set();

/** Which scenes are being added right now, by look id. */
export const useAddingScenes = (): ReadonlySet<string> =>
  useSyncExternalStore(
    subscribe,
    () => addingSnapshot,
    () => addingSnapshot,
  );

const ADD_FAILURES: Record<string, TranslationKey> = {
  unavailable: 'plus.add.unavailable',
  blocked: 'plus.add.blocked',
  changed: 'plus.add.changed',
  refused: 'plus.add.failed',
};

/**
 * Downloads a scene into the member's looks. The main process verifies it
 * exactly as it verifies a file somebody sent; this only says how it went.
 */
export const addGalleryScene = async (
  scene: IGalleryScene,
  name: string,
): Promise<boolean> => {
  if (adding.has(scene.lookId)) {
    return false;
  }
  adding.add(scene.lookId);
  addingSnapshot = new Set(adding);
  notice = undefined;
  notify();
  let outcome: TGalleryAddOutcome;
  try {
    outcome = (await bridge()?.addGalleryScene?.(
      scene.authorId,
      scene.sceneId,
      scene.version,
      scene.updatedAt,
    )) ?? { ok: false, reason: 'unavailable' };
    // Add may answer before the official pack announcement arrives. Refresh
    // its real store so the card and Play agree with the premium look picker.
    if (outcome.ok) {
      if (scene.official) {
        await refreshScenePacks(true);
      } else {
        await refreshMemberScenes();
      }
    }
  } catch {
    outcome = { ok: false, reason: 'unavailable' };
  }
  adding.delete(scene.lookId);
  addingSnapshot = new Set(adding);
  if (outcome.ok) {
    patchGalleryScene(outcome.lookId, {
      added: true,
      ...(scene.official
        ? {}
        : { adds: scene.added ? scene.adds : scene.adds + 1 }),
    });
    setGalleryNotice({ ok: true, key: 'plus.add.done', vars: { name } });
    return true;
  }
  if (outcome.reason === 'not-entitled') {
    notify();
    requestAccountPanel('subscribe');
    return false;
  }
  setGalleryNotice({
    ok: false,
    key: ADD_FAILURES[outcome.reason] ?? 'plus.add.failed',
    vars: { name },
  });
  return false;
};

/**
 * Likes a scene, or takes the like back. The heart changes at once; the
 * server's count replaces the guess when it answers, and offline puts the
 * heart back as it was.
 */
export const toggleGalleryLike = async (scene: IGalleryScene) => {
  const liked = !scene.liked;
  patchGalleryScene(scene.lookId, {
    liked,
    likes: Math.max(0, scene.likes + (liked ? 1 : -1)),
  });
  let answer: Awaited<ReturnType<typeof likeMemberSceneLook>>;
  try {
    answer = await likeMemberSceneLook(scene.lookId, liked);
  } catch {
    answer = undefined;
  }
  if (answer) {
    patchGalleryScene(scene.lookId, answer);
    return;
  }
  patchGalleryScene(scene.lookId, { liked: scene.liked, likes: scene.likes });
  setGalleryNotice({ ok: false, key: 'plus.like.offline' });
};

/** Removes only this computer's copy; the publication and creator's files stay. */
export const removeGalleryScene = async (
  scene: IGalleryScene,
  name: string,
) => {
  if (adding.has(scene.lookId)) {
    return false;
  }
  adding.add(scene.lookId);
  addingSnapshot = new Set(adding);
  notice = undefined;
  notify();
  let removed = false;
  try {
    removed =
      (scene.official
        ? await bridge()?.removeScenePack?.(scene.sceneId)
        : await bridge()?.removeMemberScene?.(scene.lookId)) ?? false;
    if (removed) {
      if (scene.official) {
        await refreshScenePacks(true);
      } else {
        await refreshMemberScenes();
      }
    }
  } catch {
    removed = false;
  }
  adding.delete(scene.lookId);
  addingSnapshot = new Set(adding);
  if (removed) {
    patchGalleryScene(scene.lookId, { added: false });
  }
  setGalleryNotice({
    ok: removed,
    key: removed ? 'plus.remove.done' : 'plus.remove.failed',
    vars: { name },
  });
  return removed;
};

export const reportGalleryScene = async (
  scene: IGalleryScene,
  reason: TReportReason,
): Promise<boolean> => {
  try {
    return (
      (await bridge()?.reportGalleryScene?.(
        scene.authorId,
        scene.sceneId,
        reason,
      )) ?? false
    );
  } catch {
    return false;
  }
};

/** For tests: a clean module between runs. */
export const resetGalleryActions = () => {
  notice = undefined;
  adding.clear();
  addingSnapshot = new Set();
  listeners.clear();
};
