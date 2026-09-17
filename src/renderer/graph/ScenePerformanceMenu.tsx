/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  SCENE_AUTO_FLOORS,
  SCENE_FRAME_RATES,
  SCENE_RESOLUTIONS,
  SCENE_SMOOTHINGS,
  SCENE_UPSCALERS,
  type TSceneAutoFloor,
  type TSceneFrameRate,
  type TSceneResolution,
  type TSceneSmoothing,
  type TSceneUpscaler,
} from 'common/scenePerformance';
import {
  GPU_PREFERENCES,
  type TGpuPreference,
} from 'common/graphicsPreference';
import { useTranslation } from '../utils/I18nContext';
import { sceneGpuName } from './sceneGpuName';
import { useOnBattery } from '../utils/batteryPower';
import {
  setGraphicsPreference,
  useGraphicsPreference,
} from '../utils/graphicsPreferenceStore';
import {
  setScenePerformance,
  useScenePerformance,
} from '../utils/scenePerformanceStore';

const FRAME_RATE_LABEL: Record<TSceneFrameRate, TranslationKey> = {
  display: 'graph.scene.frameRate.display',
  sixty: 'graph.scene.frameRate.sixty',
  thirty: 'graph.scene.frameRate.thirty',
};

const RESOLUTION_LABEL: Record<TSceneResolution, TranslationKey> = {
  auto: 'graph.scene.resolution.auto',
  native: 'graph.scene.resolution.native',
  quality: 'graph.scene.resolution.quality',
  balanced: 'graph.scene.resolution.balanced',
  performance: 'graph.scene.resolution.performance',
};

const FLOOR_LABEL: Record<TSceneAutoFloor, TranslationKey> = {
  0.35: 'graph.scene.floor.35',
  0.5: 'graph.scene.floor.50',
  0.67: 'graph.scene.floor.67',
  0.85: 'graph.scene.floor.85',
};

const SCALER_LABEL: Record<TSceneUpscaler, TranslationKey> = {
  fsr: 'graph.scene.scaler.fsr',
  simple: 'graph.scene.scaler.simple',
};

const SMOOTHING_LABEL: Record<TSceneSmoothing, TranslationKey> = {
  off: 'graph.scene.smoothing.off',
  fast: 'graph.scene.smoothing.fast',
  best: 'graph.scene.smoothing.best',
};

const GPU_LABEL: Record<TGpuPreference, TranslationKey> = {
  auto: 'graph.scene.gpu.auto',
  high: 'graph.scene.gpu.high',
};

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

const after = <T,>(list: readonly T[], current: T): T =>
  list[(list.indexOf(current) + 1) % list.length];

/**
 * One row that cycles its choice on each click, its current answer at the
 * right — and, when the answer is not yet in force, a note under it.
 */
function CycleRow({
  hint,
  label,
  value,
  note,
  icon,
  onCycle,
}: {
  hint: TranslationKey;
  label: TranslationKey;
  value: string;
  note?: string;
  icon: ReactNode;
  onCycle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button type="button" role="menuitem" title={t(hint)} onClick={onCycle}>
      <Icon>{icon}</Icon>
      <span>{t(label)}</span>
      <span className="graph-view-menu__value">
        {value}
        {note && <span className="graph-view-menu__note">{note}</span>}
      </span>
    </button>
  );
}

/**
 * How hard Plus visualizers drive the GPU and how their picture is finished,
 * in the View menu (`common/scenePerformance.ts`): the frame rate, the
 * resolution — automatic, full, or a fixed preset brought up to size every
 * frame, as DLSS and FSR do in games — the scaler that does it, the edge
 * smoothing, and on a laptop with two graphics cards, which one the app runs
 * on. Rows that cycle on a click, as the wave orientation row does, each
 * showing its current answer where the other rows show their shortcut. One
 * choice for every visualizer: on the graph, in the Studio and on the desktop.
 */
export default function ScenePerformanceMenu() {
  const { t } = useTranslation();
  const { frameRate, resolution, autoFloor, upscaler, smoothing } =
    useScenePerformance();
  const onBattery = useOnBattery();
  const gpu = useGraphicsPreference();
  const frameRateValue =
    frameRate === 'display' && onBattery
      ? t('graph.scene.frameRate.displayBattery')
      : t(FRAME_RATE_LABEL[frameRate]);
  // What is drawing, under the choice: the two can differ for a whole
  // session — Remote Desktop starts the app on a laptop's integrated chip and
  // coming back to the real machine does not move it — and nothing said so.
  // A pending choice is the more urgent thing to say, so it wins the line.
  const gpuNote =
    gpu.chosen === gpu.atLaunch ? sceneGpuName() : t('graph.scene.gpu.restart');
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
          setScenePerformance({
            frameRate: after(SCENE_FRAME_RATES, frameRate),
          })
        }
      />
      <CycleRow
        hint="graph.scene.resolutionHint"
        label="graph.scene.resolution"
        value={t(RESOLUTION_LABEL[resolution])}
        // A small picture inside the panel it fills.
        icon={
          <>
            <path d="M1.5 2.5h13v11h-13z" />
            <path d="M4.5 5.5h7v5h-7z" />
          </>
        }
        onCycle={() =>
          setScenePerformance({
            resolution: after(SCENE_RESOLUTIONS, resolution),
          })
        }
      />
      <CycleRow
        hint="graph.scene.floorHint"
        label="graph.scene.floor"
        value={t(FLOOR_LABEL[autoFloor])}
        // Always on the menu, since a row that comes and goes with the row
        // above it reads as broken; under a fixed size it says when it counts.
        note={
          resolution === 'auto' ? undefined : t('graph.scene.floor.whenAuto')
        }
        // The panel with a floor line the picture may not sink under.
        icon={
          <>
            <path d="M1.5 2.5h13v11h-13z" />
            <path d="M5 6h6v4H5z" />
            <path d="M3.5 11.5h9" />
          </>
        }
        onCycle={() =>
          setScenePerformance({
            autoFloor: after(SCENE_AUTO_FLOORS, autoFloor),
          })
        }
      />
      <CycleRow
        hint="graph.scene.scalerHint"
        label="graph.scene.scaler"
        value={t(SCALER_LABEL[upscaler])}
        // An arrow out of a corner: the picture growing to the panel.
        icon={
          <>
            <path d="M2.5 13.5v-5M2.5 13.5h5" />
            <path d="M2.5 13.5l6-6" />
            <path d="M9.5 2.5h4v4" />
            <path d="M13.5 2.5l-4 4" />
          </>
        }
        onCycle={() =>
          setScenePerformance({ upscaler: after(SCENE_UPSCALERS, upscaler) })
        }
      />
      <CycleRow
        hint="graph.scene.smoothingHint"
        label="graph.scene.smoothing"
        value={t(SMOOTHING_LABEL[smoothing])}
        // A stair-stepped edge beside a smooth one.
        icon={
          <>
            <path d="M2.5 13.5v-3h2v-3h2v-3h2v-2" />
            <path d="M9 13.5c0-6 2.5-9 5-11" />
          </>
        }
        onCycle={() =>
          setScenePerformance({
            smoothing: after(SCENE_SMOOTHINGS, smoothing),
          })
        }
      />
      {gpu.supported && (
        <CycleRow
          hint="graph.scene.gpuHint"
          label="graph.scene.gpu"
          value={t(GPU_LABEL[gpu.chosen])}
          note={gpuNote}
          // A card with its fan.
          icon={
            <>
              <path d="M1.5 4.5h13v8h-13z" />
              <circle cx="6" cy="8.5" r="2.2" />
              <path d="M10.5 6.5h2M10.5 8.5h2" />
            </>
          }
          onCycle={() =>
            setGraphicsPreference(after(GPU_PREFERENCES, gpu.chosen))
          }
        />
      )}
    </>
  );
}
