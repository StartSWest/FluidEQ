/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useRef, useState } from 'react';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import FeatureFilmLarge from './FeatureFilmLarge';
import { FEATURE_FILMS, featureFilmLocale } from './featureFilms';
import FILM_POSTERS from './filmPosters';

export const WALKTHROUGH_FILM = 'walkthrough';

/**
 * What's New's first page: the whole app in one film, a voice saying how to
 * use each part (Ivan, 2026-10-28: "show it on the whats new first page").
 * The film's own frame heads the page, across its width, with the words
 * under it; a press anywhere on the frame plays the film as large as the
 * window allows, with its sound on. Nothing is fetched before that press, as
 * on every other slide.
 */
export default function WalkthroughSlide() {
  const { t, locale } = useTranslation();
  const film = FEATURE_FILMS[WALKTHROUGH_FILM];
  const opener = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);
  const watch = `${t('tour.film.watch')}${
    featureFilmLocale(locale, film) === locale
      ? ''
      : ` · ${t('tour.film.englishAudio')}`
  }`;

  return (
    <div className="tour-slide tour-slide--showcase tour-walkthrough">
      <figure className="tour-showcase__visual tour-walkthrough__visual">
        {/* The pointer's larger target; the key under it is the keyboard's
            and a screen reader's, so this one is hidden from both. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the Watch key under it plays the same film from the keyboard */}
        <div
          className="tour-walkthrough__poster"
          aria-hidden="true"
          style={{ aspectRatio: `${film.width} / ${film.height}` }}
          onClick={() => setOpen(true)}
        >
          <img src={FILM_POSTERS[WALKTHROUGH_FILM]} alt="" />
          <span className="tour-walkthrough__play">
            <PlayerIcon name="play" />
          </span>
        </div>
      </figure>
      <div className="tour-slide__text tour-walkthrough__text">
        <div className="tour-walkthrough__words">
          <span className="tour-slide__kicker">
            {t('tour.walkthrough.kicker')}
          </span>
          <h3 className="tour-slide__title">{t('tour.walkthrough.title')}</h3>
          <p className="tour-slide__lead">{t('tour.walkthrough.lead')}</p>
        </div>
        <button
          ref={opener}
          type="button"
          className="button small tour-walkthrough__watch"
          onClick={() => setOpen(true)}
        >
          <PlayerIcon name="play" />
          {watch}
        </button>
      </div>
      {isOpen && (
        <FeatureFilmLarge
          id={WALKTHROUGH_FILM}
          film={film}
          startAt={0}
          onClose={() => {
            setOpen(false);
            opener.current?.focus();
          }}
        />
      )}
    </div>
  );
}
