import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import { setGraphLook } from '../utils/graphStyle';
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
 * takes the new version: a maker's own scene plays everywhere for them,
 * published or not (Ivan, 2026-10-21: "no need to publish to run on grahp").
 */
export default function useStudioKeep(
  name: string,
  wave: IStudioWave,
  notify: (notice: ISharingNotice) => void,
  /** Brings the EQ page and its graph forward (`CommunityPanel`). */
  showGraph: () => void,
) {
  const canSetDesktop = useCanSetDesktop();
  const [settingDesktop, setSettingDesktop] = useState(false);

  const keep = (kept: (scene: IMemberSceneSummary) => void) => {
    // A new object on every press, so keeping again shows the toast again.
    // Each failure in its own words: one line for all of them told a member
    // who was signed out, or whose save failed, that the scene did not play.
    const failed = () => notify({ ok: false, key: 'studio.notice.saveFailed' });
    const said: Partial<Record<string, TranslationKey>> = {
      'signed-out': 'studio.notice.signedOut',
      'no-build': 'studio.notice.addFailed',
    };
    return addStudioSceneToLooks()
      .then((outcome) => {
        if (outcome.ok) {
          // Added the first time, updated every time after: the same press
          // brings the look to the version on the stage.
          notify({
            ok: true,
            key: outcome.updated
              ? 'studio.notice.updated'
              : 'studio.notice.added',
            vars: { name },
          });
          kept(outcome.scene);
        } else if (outcome.reason === 'inspect-only') {
          notify({ ok: false, key: 'studio.inspect.locked' });
        } else {
          notify({
            ok: false,
            key: said[outcome.reason] ?? 'studio.notice.saveFailed',
          });
        }
        return undefined;
      })
      .catch(failed);
  };

  const add = () => {
    keep(() => undefined);
  };

  // The version on the stage, kept or brought up to date in the looks, then
  // chosen on the graph and the graph shown: the gallery's own Play on the
  // graph (`ScenePage`), so trying a scene where it will be seen is one
  // press instead of three. A keep that fails leaves the graph as it was.
  const play = () => {
    keep((scene) => {
      setGraphLook(scene.lookId);
      showGraph();
    });
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
    play,
    /** Absent on a computer that cannot put a visualizer on its desktop. */
    setDesktop: canSetDesktop ? setDesktop : undefined,
    settingDesktop,
  };
}
