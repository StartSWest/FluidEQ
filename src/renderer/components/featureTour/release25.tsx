/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import FeatureFilmLarge from './FeatureFilmLarge';
import ShowcaseSlide from './ShowcaseSlide';
import StudioCodeVisual from './StudioCodeVisual';
import StudioEditVisual from './StudioEditVisual';
import StudioFullscreenVisual from './StudioFullscreenVisual';
import StudioMakersVisual from './StudioMakersVisual';
import StudioWatchVisual from './StudioWatchVisual';
import { FEATURE_FILMS, featureFilmLocale, VISUALS_FILM } from './featureFilms';
import type { ISlideActions } from './slides';

/**
 * What 2.5 brings the visualizers, all of it in the Visualizers' own What's
 * New (Ivan, 2026-11-11: yes to 2.5's Studio news as slides there): Edit
 * mode, full screen with the work pane and the chat, the AI that watches a
 * scene move, Higgsfield as the Studio's maker,
 * and the Code tab's every file, with the rest of the release for makers and
 * listeners listed under that last one.
 */
interface ISlideProps {
  actions: ISlideActions;
}

/**
 * Everything visual in FluidEQ in one film (Ivan, 2026-11-12), under the
 * first of these slides as the walkthrough is behind the sound's first page:
 * a Watch key that plays it as large as the window allows. Nothing is asked
 * of the site before that press, as the terms promise ("nothing is fetched
 * until you press Play or Watch"); the film is recorded after this build, so
 * until it is uploaded the press opens the player on "coming soon" rather
 * than an error.
 */
function VisualsFilmSection() {
  const { t, locale } = useTranslation();
  const film = FEATURE_FILMS[VISUALS_FILM];
  const opener = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);
  const watch = `${t('tour.film.watch')}${
    featureFilmLocale(locale, film) === locale
      ? ''
      : ` · ${t('tour.film.englishAudio')}`
  }`;

  return (
    <section
      className="tour-slide__how dialog-frame__group tour-release25__film"
      aria-labelledby="tour-release25-film"
    >
      <span className="tour-release25__film-mark" aria-hidden="true">
        <PlayerIcon name="play" />
      </span>
      <span className="tour-release25__film-words">
        <h4 className="tour-slide__how-title" id="tour-release25-film">
          {t('tour.film.visuals.intro')}
        </h4>
        <p>{t('tour.v25.film.body')}</p>
      </span>
      <button
        ref={opener}
        type="button"
        className="button small tour-release25__film-watch"
        onClick={() => setOpen(true)}
      >
        <PlayerIcon name="play" />
        {watch}
      </button>
      {isOpen && (
        <FeatureFilmLarge
          id={VISUALS_FILM}
          film={film}
          startAt={0}
          unavailable="tour.v25.film.soon"
          onClose={() => {
            setOpen(false);
            opener.current?.focus();
          }}
        />
      )}
    </section>
  );
}

export function EditSlide({ actions }: ISlideProps) {
  return (
    // 2.4's slide-and-section column (`_tour-release24b.scss`), as under the
    // last slide.
    <div className="tour-release24">
      <ShowcaseSlide
        prefix="tour.edit"
        onOpen={() => actions.openTab('community')}
        visual={<StudioEditVisual />}
      />
      <VisualsFilmSection />
    </div>
  );
}

export function FullscreenSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.fullscreen"
      onOpen={() => actions.openTab('community')}
      visual={<StudioFullscreenVisual />}
    />
  );
}

export function WatchSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.watch"
      onOpen={() => actions.openTab('community')}
      visual={<StudioWatchVisual />}
    />
  );
}

export function MakersSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.makers"
      onOpen={() => actions.openTab('community')}
      visual={<StudioMakersVisual />}
    />
  );
}

/** The rest of 2.5 on the visualizers' side, under its last slide. */
const ALSO: readonly TranslationKey[] = [
  'tour.v25.recover',
  'tour.v25.never',
  'tour.v25.painted',
  'tour.v25.views',
  'tour.v25.review',
  'tour.v25.publish',
];

export function CodeSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    // 2.4's list under a slide, kept in its classes (`_tour-release24b.scss`).
    <div className="tour-release24">
      <ShowcaseSlide
        prefix="tour.code"
        onOpen={() => actions.openTab('community')}
        visual={<StudioCodeVisual />}
      />
      <section
        className="tour-slide__how dialog-frame__group tour-release24__also"
        aria-labelledby="tour-release25-also"
      >
        <h4 className="tour-slide__how-title" id="tour-release25-also">
          {t('tour.v25.also')}
        </h4>
        <ul className="tour-showcase__points">
          {ALSO.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
