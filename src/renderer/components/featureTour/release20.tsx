/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import EngineSoundVisual from './EngineSoundVisual';
import ShowcaseSlide from './ShowcaseSlide';
import SparksVisual from './SparksVisual';
import VisualizerEngineVisual, { lookNames } from './VisualizerEngineVisual';
import type { ISlideActions } from './slides';

/**
 * 2.0's slides for what landed after the release was first prepared (the
 * rest are in `release18.tsx`): the visualizer engine, the sparks a Plus
 * visualizer throws from the pointer, and the FluidEQ Engine's sound. Each
 * quotes the app's own labels for the controls it sends the reader to, so a
 * renamed control renames the slide.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function VisualizerEngineSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.gpu"
      onOpen={() => actions.openTab('eq')}
      visual={<VisualizerEngineVisual />}
      values={{
        scenes: t('graph.family.scenes'),
        brightness: t('graph.sceneTint.brightness'),
        ...lookNames(t),
      }}
    />
  );
}

export function SparksSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.sparks"
      onOpen={() => actions.openTab('eq')}
      visual={<SparksVisual />}
      values={{
        sparks: t('graph.sceneTint.sparks'),
        windowColours: t('graph.sceneTint.label'),
        rainbow: t('graph.sceneTint.rainbow'),
        ambient: t('graph.sceneTint.short.pulse'),
        backdrop: t('graph.sceneTint.short.cover'),
      }}
    />
  );
}

export function EngineSoundSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.sound"
      onOpen={() => actions.openTab('eq')}
      visual={<EngineSoundVisual />}
      values={{
        eqMode: t('eq.mode'),
        treble: t('eq.mode.treble'),
        precise: t('eq.mode.precise'),
        classic: t('eq.mode.classic'),
        autoNormalize: t('sidebar.autoPreamp'),
      }}
    />
  );
}
