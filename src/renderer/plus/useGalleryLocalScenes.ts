import { useMemo, useSyncExternalStore } from 'react';
import type { ISceneCameraLimits } from 'common/sceneCamera';
import { premiumLookId } from 'common/scenePacks';
import {
  getMemberSceneListing,
  subscribeMemberScenes,
} from '../utils/memberScenes';
import {
  getScenePackListing,
  subscribeScenePacks,
  type IUsableScene,
} from '../utils/scenePacks';

/**
 * A scene the gallery lists, as this computer holds it: which version, and
 * how far its camera moves (`GalleryMoveTag`), read from the pack itself.
 */
export type TGalleryLocalScene = Pick<IUsableScene, 'lookId' | 'version'> & {
  camera?: ISceneCameraLimits;
};

/** Official and member looks keep their own eligibility and storage rules. */
export default function useGalleryLocalScenes() {
  const official = useSyncExternalStore(
    subscribeScenePacks,
    getScenePackListing,
  );
  const members = useSyncExternalStore(
    subscribeMemberScenes,
    getMemberSceneListing,
  );
  return useMemo(
    () =>
      new Map<string, TGalleryLocalScene>(
        [
          ...official.packs.map((scene) => ({
            ...scene,
            lookId: premiumLookId(scene.id),
          })),
          ...members.scenes,
        ].map((scene) => [scene.lookId, scene]),
      ),
    [official, members],
  );
}
