import {
  isPremiumLookId,
  packIdOfLook,
  type IScenePack,
} from '../../common/scenePacks';
import type { TSceneFailure } from '../scenePackStore';
import type { IWallpaperScene } from './surface';

/** The looks a desktop background can show, whichever kind each one is. */
export interface IWallpaperScenes {
  loadScene(lookId: string): IWallpaperScene | undefined;
  subscribeScenes(listener: () => void): () => void;
  /**
   * A background's scene failed on this computer's graphics, right now.
   * Logged for operator visibility only — it does not stop a later attempt.
   */
  reportSceneFailure(lookId: string, reason: TSceneFailure): void;
}

/** FluidEQ's own looks, by pack id (`registerScenePacksIpc`). */
export interface IOfficialLooks {
  store: { load(id: string): IScenePack | undefined };
  subscribeScenes(listener: () => void): () => void;
  reportFailure(id: string, reason: TSceneFailure): void;
}

/** Members' looks, by look id (`registerMemberScenesIpc`). */
export interface IMemberLooks {
  loadVisible(lookId: unknown): IScenePack | undefined;
  subscribeScenes(listener: () => void): () => void;
  reportFailure(lookId: string, reason: TSceneFailure): void;
}

/**
 * Both kinds of look behind one set of calls: the look id says which store
 * answers, so a premium id never reaches the member store or the other way.
 */
export const createWallpaperScenes = (
  official: IOfficialLooks,
  member: IMemberLooks,
): IWallpaperScenes => ({
  loadScene: (lookId) => {
    if (isPremiumLookId(lookId)) {
      const pack = official.store.load(packIdOfLook(lookId));
      return pack ? { pack, member: false } : undefined;
    }
    const pack = member.loadVisible(lookId);
    return pack ? { pack, member: true } : undefined;
  },
  subscribeScenes: (listener) => {
    const stopOfficial = official.subscribeScenes(listener);
    const stopMember = member.subscribeScenes(listener);
    return () => {
      stopOfficial();
      stopMember();
    };
  },
  reportSceneFailure: (lookId, reason) => {
    if (isPremiumLookId(lookId)) {
      official.reportFailure(packIdOfLook(lookId), reason);
    } else {
      member.reportFailure(lookId, reason);
    }
  },
});
