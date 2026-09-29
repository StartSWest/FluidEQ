/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_PRESETS } from '../../../common/dsp/presets';
import { useTranslation } from '../../utils/I18nContext';
import CompactPlayerVisual from './CompactPlayerVisual';
import GameStoryVisual from './GameStoryVisual';
import PresetsVisual from './PresetsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import { GuideVisual, StudioVisual, ToneVisual } from './release18Visuals';
import TitlebarCorner from './TitlebarCorner';
import { GraphViewsVisual, LookVisual } from './release20Visuals';
import type { ISlideActions } from './slides';

/**
 * What 2.0 announces, one headline slide each (prepared as 1.8, hence the
 * file's name). The Room's slide is 1.7's, moved up with new words
 * (`slides.ts` says why); these are the rest.
 */
interface ISlideProps {
  actions: ISlideActions;
}

/**
 * The catalogue's own counts, so the slide cannot go stale the way "nine
 * stages" and "38 styles" did: None is the absence of a chain, not one.
 */
const PRESET_COUNTS = {
  chains: DSP_PRESETS.filter((preset) => preset.id !== 'empty').length,
  styles: DSP_PRESETS.filter((preset) => preset.group === 'genre').length,
};

/**
 * The new look. Its words name the controls by the app's own labels, read
 * here, so a renamed slider cannot leave the slide saying the old name.
 */
export function LookSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.look"
      onOpen={() => actions.openTab('eq')}
      visual={<LookVisual />}
      values={{
        brightness: t('graph.sceneTint.brightness'),
        transparency: t('graph.backdropVeil'),
        windowColours: t('graph.sceneTint.label'),
        original: t('graph.sceneTint.short.off'),
        colours: t('graph.sceneTint.short.tint'),
        ambient: t('graph.sceneTint.short.pulse'),
        backdrop: t('graph.sceneTint.short.cover'),
        rainbow: t('graph.sceneTint.rainbow'),
      }}
    />
  );
}

/** The graph's measuring views, named as the look picker names them. */
export function GraphViewsSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.graph"
      onOpen={() => actions.openTab('eq')}
      visual={<GraphViewsVisual />}
      values={{
        analyzer: t('graph.styleName.analyzer'),
        spectrogram: t('graph.styleName.spectrogram'),
        rta: t('graph.styleName.rta'),
        waterfall: t('graph.styleName.waterfall'),
        scope: t('graph.styleName.scope'),
        analysis: t('graph.family.analysis'),
      }}
    />
  );
}

export function CompactPlayerSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.player"
      onOpen={actions.openPlayer}
      visual={<CompactPlayerVisual />}
      values={{ backdrop: t('graph.sceneTint.short.cover') }}
    />
  );
}

export function GamePresetsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.games"
      onOpen={() => actions.openTab('games')}
      visual={<GameStoryVisual />}
    />
  );
}

export function PresetsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.presets"
      onOpen={() => actions.openTab('eq')}
      visual={<PresetsVisual />}
      values={PRESET_COUNTS}
    />
  );
}

export function ToneSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.tone"
      onOpen={() => actions.openTab('eq')}
      visual={<ToneVisual />}
    />
  );
}

export function StudioSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.studio"
      onOpen={() => actions.openTab('community')}
      visual={<StudioVisual />}
    />
  );
}

/**
 * The guide, under the place it opens from: Help's book in the title bar,
 * ringed and named. The corner is a picture of a control, not one, so it is
 * kept from the reader's screen reader; the guide below it says the rest.
 */
export function GuideSearchSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.help"
      onOpen={actions.openGuide}
      visual={
        <div className="tour-corner-stack">
          <span className="tour-corner-stack__corner" aria-hidden="true">
            <TitlebarCorner ringed="help" label={t('help.menu')} />
          </span>
          <GuideVisual />
        </div>
      }
    />
  );
}
