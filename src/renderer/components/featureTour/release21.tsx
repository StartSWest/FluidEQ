/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import BandsVisual from './BandsVisual';
import OutputsVisual from './OutputsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import SongsVisual from './SongsVisual';
import type { ISlideActions } from './slides';

/**
 * 2.1's slides: every output keeping its own sound, the bands read out on
 * the graph with EQ mode beside it, and songs that remember their sound. Each
 * quotes the app's own labels for the controls it sends the reader to, so a
 * renamed control renames the slide.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function OutputsSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.outputs"
      onOpen={() => actions.openTab('eq')}
      visual={<OutputsVisual />}
      values={{
        output: t('output.title'),
        secondOutput: t('extraOutput.title'),
        editSound: t('extraOutput.edit'),
      }}
    />
  );
}

export function BandsSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.bands"
      onOpen={() => actions.openTab('eq')}
      visual={<BandsVisual />}
      values={{
        view: t('graph.view.normal'),
        everything: t('graph.contents.everything'),
        shortcut: t('tour.bands.shortcut'),
        eqMode: t('eq.mode'),
        yourEq: t('eq.mode.yourEq'),
        corrections: t('eq.mode.curves'),
      }}
    />
  );
}

export function SongsSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.songs"
      onOpen={() => actions.openTab('eq')}
      visual={<SongsVisual />}
      values={{
        songSound: t('songSound.switch'),
        output: t('output.title'),
        undo: t('songSound.undo'),
        forget: t('songSound.forget'),
      }}
    />
  );
}
