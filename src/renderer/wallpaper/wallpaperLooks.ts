import { useMemo } from 'react';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import { resolveSceneName } from '../../common/scenePacks';
import type { ILookThumbnailRef } from '../graph/lookThumbnails';
import { findGalleryScene } from '../plus/galleryStore';
import { useTranslation } from '../utils/I18nContext';
import { loadMemberScene, useUsableMemberScenes } from '../utils/memberScenes';
import { loadScenePack, useUsableScenes } from '../utils/scenePacks';

export interface IWallpaperLook {
  name: string;
  /** Its maker's two to four colours, already checked as hex. */
  swatch: readonly string[];
  /**
   * How to picture it on a monitor: the frame its maker published when the
   * gallery has one, and otherwise a frame drawn from the scene installed
   * here — the same picture the graph's picker shows, from the same cache.
   */
  picture?: ILookThumbnailRef;
}

/** Name and colours of whatever visualizer a monitor shows, by look id. */
const useWallpaperLooks = (): ((lookId: string) => IWallpaperLook) => {
  const official = useUsableScenes();
  const members = useUsableMemberScenes();
  const { t, locale } = useTranslation();
  return useMemo(() => {
    const looks = new Map<string, IWallpaperLook>();
    official.forEach((scene) =>
      looks.set(scene.lookId, {
        name: resolveSceneName(scene, locale),
        swatch: scene.swatch,
        picture: {
          lookId: scene.lookId,
          // The revision moves with a republished version of the same number,
          // so a scene changed by its maker is pictured afresh.
          version: scene.revision ?? String(scene.version),
          published: {
            authorId: FLUIDEQ_CREATOR_ID,
            sceneId: scene.id,
            version: scene.version,
          },
          load: () => loadScenePack(scene.id),
        },
      }),
    );
    members.forEach((scene) => {
      const gallery = findGalleryScene(scene.lookId);
      looks.set(scene.lookId, {
        name: resolveSceneName(scene, locale),
        swatch: scene.swatch,
        picture: {
          lookId: scene.lookId,
          version: scene.revision ?? String(scene.version),
          published: gallery && {
            authorId: gallery.authorId,
            sceneId: gallery.sceneId,
            version: gallery.version,
            revision: gallery.updatedAt,
          },
          load: () => loadMemberScene(scene.lookId),
        },
      });
    });
    // A scene uninstalled or locked since it was set still has a monitor to
    // stop; it is named generically rather than hidden.
    const unknown: IWallpaperLook = {
      name: t('wallpaper.visualizer.unknown'),
      swatch: [],
    };
    return (lookId: string) => looks.get(lookId) ?? unknown;
  }, [official, members, locale, t]);
};

export default useWallpaperLooks;
