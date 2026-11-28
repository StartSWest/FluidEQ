/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { TranslationKey } from 'common/i18n';
import {
  SCENE_MENU_FRAME_RATES,
  SCENE_QUALITIES,
  type IScenePerformance,
  type TScenePerformanceGroup,
  type TSceneFrameRate,
  type TSceneQuality,
} from 'common/scenePerformance';
import { useTranslation } from '../utils/I18nContext';
import { CycleRow } from './ViewMenuCycleRow';
import { sceneGpuName } from './sceneGpuName';
import { useOnBattery } from '../utils/batteryPower';
import {
  setScenePerformance,
  useScenePerformance,
} from '../utils/scenePerformanceStore';

const FRAME_RATE_LABEL: Record<TSceneFrameRate, TranslationKey> = {
  display: 'graph.scene.frameRate.display',
  sixty: 'graph.scene.frameRate.sixty',
  thirty: 'graph.scene.frameRate.thirty',
  fifteen: 'graph.scene.frameRate.fifteen',
};

const QUALITY_LABEL: Record<TSceneQuality, TranslationKey> = {
  auto: 'scene.quality.auto',
  balanced: 'scene.quality.balanced',
  full: 'scene.quality.full',
};

const QUALITY_HINT: Record<TSceneQuality, TranslationKey> = {
  auto: 'scene.quality.auto.hint',
  balanced: 'scene.quality.balanced.hint',
  full: 'scene.quality.full.hint',
};

/** The next choice after this one, round again from the start. */
const after = <T,>(list: readonly T[], current: T): T =>
  list[(list.indexOf(current) + 1) % list.length];

/**
 * How visualizers are drawn, in the View menu and the Studio's Performance
 * tab (`common/scenePerformance.ts`): the frame rate, and the quality —
 * Auto, Balanced or Full — which decides everything else about the picture.
 * Rows that cycle on a click, as the wave orientation row does, each showing
 * its current answer, and under the quality the graphics card drawing it.
 * One choice per group; Plus shares its choice with the Studio and desktop.
 */
export default function ScenePerformanceMenu({
  group = 'plus',
}: {
  group?: TScenePerformanceGroup;
}) {
  const { t } = useTranslation();
  const { frameRate, quality } = useScenePerformance(group);
  const update = (next: Partial<IScenePerformance>) =>
    setScenePerformance(next, group);
  const onBattery = useOnBattery();
  const frameRateValue =
    frameRate === 'display' && onBattery
      ? t('graph.scene.frameRate.displayBattery')
      : t(FRAME_RATE_LABEL[frameRate]);
  return (
    <>
      <CycleRow
        hint="graph.scene.frameRateHint"
        label="graph.scene.frameRate"
        value={frameRateValue}
        // Three frames, each a step on: a strip of motion.
        icon={
          <path d="M1.5 4.5h3.5v7H1.5zM6.25 4.5h3.5v7h-3.5zM11 4.5h3.5v7H11z" />
        }
        onCycle={() =>
          update({
            frameRate: after(SCENE_MENU_FRAME_RATES, frameRate),
          })
        }
      />
      <CycleRow
        // What the current choice does, on the row itself.
        hint={QUALITY_HINT[quality]}
        label="scene.quality"
        value={t(QUALITY_LABEL[quality])}
        // Which graphics card is drawing, because it is not always the fast
        // one in the machine: Remote Desktop starts the app on a laptop's
        // built-in graphics, and from the outside that looks like the app
        // having become slow.
        report={sceneGpuName()}
        // A gauge and its needle.
        icon={
          <>
            <path d="M2.5 12a5.5 5.5 0 0 1 11 0" />
            <path d="M8 12l2.75-3.5" />
          </>
        }
        onCycle={() => update({ quality: after(SCENE_QUALITIES, quality) })}
      />
    </>
  );
}
