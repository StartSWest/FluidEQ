/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useTranslation } from '../../utils/I18nContext';
import LitSlide from './LitSlide';
import TourLiveFigure from './TourLiveFigure';
import TourSplitWindow from './TourSplitWindow';
import AutoEqLive from './live26/AutoEqLive';
import DynamicsLive from './live26/DynamicsLive';
import EqLive from './live26/EqLive';
import KaraokeLive from './live26/KaraokeLive';
import LibraryLive from './live26/LibraryLive';
import MicLive from './live26/MicLive';
import type { ISlideActions } from './slides';

/**
 * 2.6's sound, in the sound's What's New: look A (Ivan, 2026-11-25). The
 * window first, because it is what everybody sees, then what there is more
 * to hear, each on a live picture of the page it is on.
 */

/**
 * The first page: a short head on the left, and under it the window, white
 * and dark across a seam, as large as the slide holds (Ivan, 2026-11-25:
 * "the new windows, the light and black we show, need to cover the whole
 * scene. I don't like the text on the top right like that"). It used to end
 * on six cards, one per slide after it; the rail beside the stage lists the
 * same six, and every one of them cost the window height.
 */
export function WindowSlide() {
  const { t } = useTranslation();
  return (
    <div className="tour-slide tour-lit tour-lit--window">
      <header className="tour-lit__opener">
        <span className="tour-slide__kicker">
          {t('tour.v26.window.kicker')}
        </span>
        <h3 className="tour-slide__title">{t('tour.v26.window.title')}</h3>
        <p className="tour-slide__lead">{t('tour.v26.window.lead')}</p>
      </header>

      <figure className="tour-lit__figure tour-lit__figure--window">
        <TourSplitWindow />
        <figcaption className="tour-lit__hint">
          {t('tour.v26.window.hint')}
        </figcaption>
      </figure>
    </div>
  );
}

export function AutoEqSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.autoEq"
      isTall
      onOpen={() => actions.openTab('eq')}
      figure={
        <TourLiveFigure
          Drawing={AutoEqLive}
          width={440}
          height={560}
          marks={[
            { target: '.eq-auto-now' },
            { target: '#tour-auto-albums-title' },
            { target: '.tour-live26-autoeq__smart strong' },
          ]}
        />
      }
    />
  );
}

export function MicSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.mic"
      onOpen={() => actions.openTab('mic')}
      figure={
        <TourLiveFigure
          Drawing={MicLive}
          width={1100}
          height={640}
          marks={[
            { target: '.studio-rail__body', side: 'left' },
            { target: '.mic-picture', side: 'top' },
            { target: '.mic-head__profile', side: 'left' },
          ]}
        />
      }
    />
  );
}

export function EqSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.eq"
      onOpen={() => actions.openTab('eq')}
      figure={
        <TourLiveFigure
          Drawing={EqLive}
          width={1000}
          height={520}
          marks={[
            { target: '.eq-layer-tabs__list', side: 'right' },
            { target: '.eq-preset-tab__group:first-child', side: 'right' },
            { target: '.eq-preset-tab__grid > :nth-child(2)', side: 'top' },
          ]}
        />
      }
    />
  );
}

export function LibrarySlide26({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.library"
      isTall
      onOpen={() => actions.openTab('library')}
      figure={
        <TourLiveFigure
          Drawing={LibraryLive}
          width={380}
          height={600}
          marks={[
            { target: '.library-lyrics__stage', side: 'left' },
            { target: '.library-lyrics__other', side: 'right' },
            { target: '.library-lyrics__karaoke', side: 'corner' },
          ]}
        />
      }
    />
  );
}

export function KaraokeSlide26({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.karaoke"
      onOpen={() => actions.openTab('karaoke')}
      figure={
        <TourLiveFigure
          Drawing={KaraokeLive}
          width={1000}
          height={330}
          marks={[
            { target: '.karaoke-pitch' },
            { target: '.karaoke-score__lines li:first-child', side: 'left' },
            { target: '.karaoke-score__total', side: 'top' },
          ]}
        />
      }
      also={{
        heading: 'tour.v26.also',
        lines: [
          'tour.v26.also.normalizer',
          'tour.v26.also.deEsser',
          'tour.v26.also.wave',
          'tour.v26.also.notices',
          'tour.v26.also.lighter',
        ],
      }}
    />
  );
}

export function DynamicsSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.dynamics"
      onOpen={() => actions.openTab('dsp')}
      figure={
        <TourLiveFigure
          Drawing={DynamicsLive}
          width={900}
          height={655}
          marks={[
            // The readout that says what the band is doing now, beside the
            // dot, which moves too fast to wear a number.
            { target: '.is-band-1 .dsp-dynamics-readout' },
            { target: '.is-band-0 .dsp-dynamics-point__mark' },
            { target: '.is-band-2 .dsp-dynamics-values', side: 'top' },
          ]}
        />
      }
    />
  );
}
