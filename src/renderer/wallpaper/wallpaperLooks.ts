import { useMemo } from 'react';
import { resolveSceneName } from '../../common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes } from '../utils/scenePacks';

export interface IWallpaperLook {
  name: string;
  /** Its maker's two to four colours, already checked as hex. */
  swatch: readonly string[];
}

/** Name and colours of whatever visualizer a monitor shows, by look id. */
const useWallpaperLooks = (): ((lookId: string) => IWallpaperLook) => {
  const official = useUsableScenes();
  const members = useUsableMemberScenes();
  const { t, locale } = useTranslation();
  return useMemo(() => {
    const looks = new Map<string, IWallpaperLook>();
    [...official, ...members].forEach((scene) =>
      looks.set(scene.lookId, {
        name: resolveSceneName(scene, locale),
        swatch: scene.swatch,
      }),
    );
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
