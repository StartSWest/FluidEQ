import { useEffect, useMemo } from 'react';
import type { IWallpaperTuning } from '../../common/wallpaper';
import { useWatchedGraphWave } from '../utils/graphViewSettings';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useAllListenerParams } from '../utils/sceneParamStore';
import { useAllListenerResponses } from '../utils/sceneResponseStore';
import { useAllListenerWaves } from '../utils/sceneWaveStore';
import { useUsableScenes } from '../utils/scenePacks';
import { sendSceneTuning } from './wallpaperStore';

/**
 * What every visualizer is set to, sent to the monitors that show one.
 *
 * A desktop background is the same visualizer the graph draws, so it is drawn
 * the same way: the controls the listener moved, the attack and release they
 * set, and the band it stands in — their own if they moved it, else the one
 * its author built it around, else the graph's. A page on a monitor has no
 * store of its own; main keeps this record with the backgrounds, hands each
 * monitor the part for the look it shows, and writes it down so the next
 * launch starts there.
 *
 * Sent whole on every change, and once when the window opens: a look nobody
 * has tuned carries only its wave, and one that leaves the list is dropped.
 */
export default function WallpaperTuning() {
  const scenes = useUsableScenes();
  const members = useUsableMemberScenes();
  const params = useAllListenerParams();
  const responses = useAllListenerResponses();
  const waves = useAllListenerWaves();
  const graphWave = useWatchedGraphWave();
  const tuning = useMemo(() => {
    const record: Record<string, IWallpaperTuning> = {};
    [...scenes, ...members].forEach((scene) => {
      const { lookId } = scene;
      const chosen = params.get(lookId);
      const response = responses.get(lookId);
      record[lookId] = {
        ...(chosen ? { params: { ...chosen } } : {}),
        ...(response ? { response: { ...response } } : {}),
        wave: waves.get(lookId) ?? scene.wave ?? graphWave,
      };
    });
    return record;
  }, [scenes, members, params, responses, waves, graphWave]);
  useEffect(() => {
    sendSceneTuning(tuning);
  }, [tuning]);
  return null;
}
