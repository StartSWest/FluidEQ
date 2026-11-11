import { sceneMakerOf } from '../../common/sceneMaker';
import {
  isPremiumLookId,
  packIdOfLook,
  type IScenePack,
} from '../../common/scenePacks';
import type { IVisibleScene } from '../memberScenes/visibleScenes';
import type { ISceneFailureEntry } from '../../common/sceneFailureLog';
import { logSceneFailure } from '../sceneFailures';
import type { IWallpaperScene } from './surface';

/**
 * Two packs are the same scene: every part of them, not the version and the
 * shader alone. A Studio save keeps its version, and what it changed can be
 * anywhere in the pack — a 3D world, a control, a picture, the camera.
 * Compared only when the stores say something changed or a monitor is set,
 * so writing both out is cheap enough; the same object is never written.
 */
export const sameScenePack = (a: IScenePack, b: IScenePack): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** The looks a desktop background can show, whichever kind each one is. */
export interface IWallpaperScenes {
  loadScene(lookId: string): IWallpaperScene | undefined;
  subscribeScenes(listener: () => void): () => void;
  /**
   * A background's scene did not play, right now: one line in the log
   * (`sceneFailures.ts`). It does not stop a later attempt.
   */
  reportSceneFailure(entry: Omit<ISceneFailureEntry, 'surface'>): void;
}

/** FluidEQ's own looks, by pack id (`registerScenePacksIpc`). */
export interface IOfficialLooks {
  store: { load(id: string): IScenePack | undefined };
  subscribeScenes(listener: () => void): () => void;
}

/** Members' looks, by look id (`registerMemberScenesIpc`). */
export interface IMemberLooks {
  /** The pack, and whether this account made it. */
  loadVisible(lookId: unknown): IVisibleScene | undefined;
  subscribeScenes(listener: () => void): () => void;
}

/**
 * Both kinds of look behind one set of calls: the look id says which store
 * answers, so a premium id never reaches the member store or the other way.
 * Each comes with who made it, as the window's own list has it: told only
 * that a member had made a scene, the desktop ran the listener's own as a
 * stranger's, through the brightness limiter member's scenes then had, and
 * ghosted it.
 */
export const createWallpaperScenes = (
  official: IOfficialLooks,
  member: IMemberLooks,
): IWallpaperScenes => ({
  loadScene: (lookId) => {
    if (isPremiumLookId(lookId)) {
      const pack = official.store.load(packIdOfLook(lookId));
      return pack ? { pack, madeBy: 'fluideq' } : undefined;
    }
    const scene = member.loadVisible(lookId);
    return scene
      ? {
          pack: scene.pack,
          madeBy: sceneMakerOf({ member: true, own: scene.own }),
        }
      : undefined;
  },
  subscribeScenes: (listener) => {
    const stopOfficial = official.subscribeScenes(listener);
    const stopMember = member.subscribeScenes(listener);
    return () => {
      stopOfficial();
      stopMember();
    };
  },
  reportSceneFailure: (entry) =>
    logSceneFailure({ ...entry, surface: 'desktop' }),
});
