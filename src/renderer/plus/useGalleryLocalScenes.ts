import { useMemo, useSyncExternalStore } from 'react';
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
      new Map<string, Pick<IUsableScene, 'lookId' | 'version'>>(
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
