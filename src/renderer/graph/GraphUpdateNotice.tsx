/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { resolveSceneName } from 'common/scenePacks';
import PlusToastStack from '../plus/PlusToastStack';
import { openGalleryPage } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useTranslation } from '../utils/I18nContext';
import {
  useSceneUpdateNotice,
  type ISceneUpdateNotice,
} from './sceneUpdateStore';
import '../styles/SceneUpdateNotice.scss';

/**
 * The graph's notice that the look it is playing has a new version
 * (`sceneUpdateStore.ts`), in the Plus tab's toast, under the graph's own
 * controls. "See what's new" opens the scene's page, where the note and the
 * earlier versions are.
 */
export default function GraphUpdateNotice() {
  const { t, locale } = useTranslation();
  const notice = useSceneUpdateNotice();
  return (
    <div className="graph-update-notice">
      <PlusToastStack<ISceneUpdateNotice>
        sources={{ update: notice }}
        text={(entry) => {
          const vars = {
            name: resolveSceneName({ names: entry.names }, locale),
            version: String(entry.version),
          };
          return entry.note
            ? t('graph.version.updatedNote', { ...vars, note: entry.note })
            : t('graph.version.updated', vars);
        }}
        action={(entry) => {
          const { scene } = entry;
          return scene
            ? {
                label: t('graph.version.see'),
                run: () => {
                  openGalleryPage({ kind: 'scene', scene });
                  requestPlusTab();
                },
              }
            : undefined;
        }}
      />
    </div>
  );
}
