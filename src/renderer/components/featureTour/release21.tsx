/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import BandsVisual from './BandsVisual';
import DeEsserVisual from './DeEsserVisual';
import EarsVisual from './EarsVisual';
import OutputsVisual from './OutputsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import SongsVisual from './SongsVisual';
import StudioChatVisual from './StudioChatVisual';
import type { ISlideActions } from './slides';

/**
 * 2.1's slides: every output keeping its own sound, the bands read out on
 * the graph with EQ mode beside it, a band tuned for each ear, songs that
 * remember their sound, the DSP rack's De-esser and the Studio's chat. Each
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
      film="every-output"
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

export function EarsSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.ears"
      film="each-ear"
      onOpen={() => actions.openTab('eq')}
      visual={<EarsVisual />}
      values={{
        both: t('eq.channels.both'),
        split: t('eq.channels.split'),
        delete: t('eq.delete'),
        reset: t('eq.menu.reset'),
        clear: t('eq.clear'),
        importInto: t('eq.channels.importInto'),
      }}
    />
  );
}

export function DeEsserSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.deesser"
      film="de-esser"
      onOpen={() => actions.openTab('dsp')}
      visual={<DeEsserVisual />}
      values={{
        deEsser: t('dsp.deEsser.title'),
        isolate: t('dsp.deEsser.isolate'),
        sensitivity: t('dsp.deEsser.sensitivity'),
        speech: t('dsp.preset.speech'),
        podcast: t('dsp.eqPreset.podcast'),
        audiobook: t('dsp.eqPreset.audiobook'),
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

export function StudioChatSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <ShowcaseSlide
      prefix="tour.chat"
      onOpen={() => actions.openTab('community')}
      visual={<StudioChatVisual />}
      values={{
        plus: t('tabs.plus'),
        studio: t('studio.title'),
        bringBack: t('studioChat.bringBack'),
        attach: t('studioChat.attach'),
      }}
    />
  );
}
