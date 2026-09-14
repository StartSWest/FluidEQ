import { useState } from 'react';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import { useCanSetDesktop } from '../wallpaper/WallpaperControls';
import { openWallpaperDialog } from '../wallpaper/wallpaperDialogs';
import { addStudioSceneToLooks } from './studioStore';
import type { IStudioWave } from './studioWave';
import type { ISharingNotice } from './useStudioSharing';

/**
 * Keeping the Studio's scene: in the member's looks, and from there on their
 * desktop.
 *
 * A desktop background plays a look, never a project folder. It comes back
 * after a restart, loaded and checked by main, and by then a folder can have
 * moved or been left half saved. So putting the scene on the desktop keeps
 * the version on the stage in the looks first, and opens the desktop's own
 * dialog on that look with the stage's wave: the band the member has been
 * judging the scene in, not whatever the graph was last set to. Pressed
 * again after more saves, the look is brought up to date and the desktop
 * takes the new version.
 */
export default function useStudioKeep(
  name: string,
  wave: IStudioWave,
  notify: (notice: ISharingNotice) => void,
) {
  const canSetDesktop = useCanSetDesktop();
  const [settingDesktop, setSettingDesktop] = useState(false);

  const keep = (kept: (scene: IMemberSceneSummary) => void) => {
    // A new object on every press, so keeping again shows the toast again.
    const failed = () => notify({ ok: false, key: 'studio.notice.addFailed' });
    return addStudioSceneToLooks()
      .then((outcome) => {
        if (outcome.ok) {
          notify({ ok: true, key: 'studio.notice.added', vars: { name } });
          kept(outcome.scene);
        } else if (outcome.reason === 'inspect-only') {
          notify({ ok: false, key: 'studio.inspect.locked' });
        } else {
          failed();
        }
        return undefined;
      })
      .catch(failed);
  };

  const add = () => {
    keep(() => undefined);
  };

  const setDesktop = () => {
    if (settingDesktop) {
      return;
    }
    setSettingDesktop(true);
    keep((scene) => openWallpaperDialog(scene.lookId, wave))
      .then(() => {
        setSettingDesktop(false);
        return undefined;
      })
      .catch(() => setSettingDesktop(false));
  };

  return {
    add,
    /** Absent on a computer that cannot put a visualizer on its desktop. */
    setDesktop: canSetDesktop ? setDesktop : undefined,
    settingDesktop,
  };
}
