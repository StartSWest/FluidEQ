import { useMemo } from 'react';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes, type IUsableScene } from '../utils/scenePacks';

/** Official and member looks keep their own eligibility and storage rules. */
export default function useGalleryLocalScenes() {
  const official = useUsableScenes();
  const members = useUsableMemberScenes();
  return useMemo(
    () =>
      new Map<string, Pick<IUsableScene, 'lookId' | 'version'>>(
        [...official, ...members].map((scene) => [scene.lookId, scene]),
      ),
    [official, members],
  );
}
