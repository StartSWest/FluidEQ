/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from '../../../common/i18n';
import MenuIcon, { type MenuIconName } from '../../icons/MenuIcon';
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

interface IChapter {
  id: string;
  icon: MenuIconName;
  title: TranslationKey;
  subtitle: TranslationKey;
}

/**
 * The slides that follow the first page, which it lists to jump to. Their
 * ids are the slides' own (`slides.ts`), so a press lands on that slide.
 */
export const SOUND_26_CHAPTERS: readonly IChapter[] = [
  {
    id: 'auto-eq-26',
    icon: 'smart',
    title: 'tour.v26.autoEq.name',
    subtitle: 'tour.v26.autoEq.subtitle',
  },
  {
    id: 'mic-26',
    icon: 'microphoneSettings',
    title: 'tour.v26.mic.name',
    subtitle: 'tour.v26.mic.subtitle',
  },
  {
    id: 'eq-26',
    icon: 'eqBars',
    title: 'tour.v26.eq.name',
    subtitle: 'tour.v26.eq.subtitle',
  },
  {
    id: 'dynamics-26',
    icon: 'steady',
    title: 'tour.v26.dynamics.name',
    subtitle: 'tour.v26.dynamics.subtitle',
  },
  {
    id: 'library-26',
    icon: 'album',
    title: 'tour.v26.library.name',
    subtitle: 'tour.v26.library.subtitle',
  },
  {
    id: 'karaoke-26',
    icon: 'microphone',
    title: 'tour.v26.karaoke.name',
    subtitle: 'tour.v26.karaoke.subtitle',
  },
];

/**
 * The first page: the window turning from white to dark under the pointer,
 * and the six things that follow, each a way straight to its slide.
 */
export function WindowSlide({ actions }: { actions: ISlideActions }) {
  const { t } = useTranslation();
  return (
    <div className="tour-slide tour-lit tour-lit--window">
      <header className="tour-lit__head">
        <div className="tour-lit__name">
          <span className="tour-slide__kicker">
            {t('tour.v26.window.kicker')}
          </span>
          <h3 className="tour-slide__title">{t('tour.v26.window.title')}</h3>
        </div>
        <div className="tour-lit__lead">
          <p className="tour-slide__lead">{t('tour.v26.window.lead')}</p>
          <p className="tour-lit__hint">{t('tour.v26.window.hint')}</p>
        </div>
      </header>

      <figure className="tour-lit__figure">
        <TourSplitWindow />
      </figure>

      <nav
        className="tour-lit__chapters"
        aria-label={t('tour.v26.window.next')}
      >
        {SOUND_26_CHAPTERS.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className="tour-lit__chapter"
            onClick={() => actions.showSlide(chapter.id)}
          >
            <MenuIcon name={chapter.icon} />
            <span className="tour-lit__chapter-title">{t(chapter.title)}</span>
            <span className="tour-lit__chapter-line">
              {t(chapter.subtitle)}
            </span>
          </button>
        ))}
      </nav>
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
