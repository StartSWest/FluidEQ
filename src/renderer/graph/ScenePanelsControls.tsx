/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useTranslation } from '../utils/I18nContext';
import { useSceneColumnHost } from '../utils/sceneCover';
import {
  SCENE_PANELS_MAX_BLUR,
  SCENE_PANELS_MAX_SEE_THROUGH,
  setScenePanelsBlur,
  setScenePanelsSeeThrough,
  useScenePanelsBlur,
  useScenePanelsSeeThrough,
} from '../utils/scenePanels';
import BackdropAppearanceControls from './BackdropAppearanceControls';
import { useScenePlot } from './graphScenePlace';

/**
 * Transparency and Blur for the EQ page's panels over a Plus scene
 * (`scenePanels.ts`), in the View menu's own group under Full screen, where
 * the same two sliders stand for the full-screen graph: the frame the scene
 * is seen in, not the scene, so one choice for every scene rather than a row
 * among each scene's own controls.
 *
 * Only while the scene is drawn behind the page, on the column's layer
 * (`graphScenePlace`): on the plot's own card, in full screen or with the
 * graph closed there is no panel standing on the picture to see through.
 */
export default function ScenePanelsControls() {
  const { t } = useTranslation();
  const seeThrough = useScenePanelsSeeThrough();
  const blur = useScenePanelsBlur();
  const column = useSceneColumnHost();
  const isOnColumn = useScenePlot()?.isPartOfWindow === true;
  if (!column || !isOnColumn) {
    return null;
  }
  return (
    <BackdropAppearanceControls
      idPrefix="scene-panels"
      opacity={1 - seeThrough / 100}
      onChangeOpacity={(opacity) =>
        setScenePanelsSeeThrough((1 - opacity) * 100)
      }
      blur={blur}
      onChangeBlur={setScenePanelsBlur}
      minOpacity={1 - SCENE_PANELS_MAX_SEE_THROUGH / 100}
      maxBlur={SCENE_PANELS_MAX_BLUR}
      transparencyHint={t('graph.scenePanelsHint')}
    />
  );
}
