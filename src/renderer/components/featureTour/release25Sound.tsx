/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { AUTHOR_NAME } from '../../../common/branding';
import MenuIcon, { type MenuIconName } from '../../icons/MenuIcon';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import FeatureFilmLarge from './FeatureFilmLarge';
import SignedCounter from './SignedCounter';
import { WALKTHROUGH_FILM } from './WalkthroughSlide';
import { FEATURE_FILMS, featureFilmLocale } from './featureFilms';
import appIcon from '../../../../assets/icons/256x256.png';
import sceneAurora from '../../../../assets/tour/scene-aurora.jpg';
import sceneNeonCity from '../../../../assets/tour/scene-neon-city.jpg';
import sceneAlpine from '../../../../assets/tour/scene-alpine.jpg';

/**
 * 2.5's opening page, the first of the sound's What's New: a milestone page
 * (Ivan, 2026-11-11: "the welcome video", "a nice intro on what we have come
 * so far", "how many days this project has been live", "a thanks for all the
 * community", "something that calls the attention").
 *
 * The hero is three of FluidEQ's own scenes as the graph drew them (the
 * tour's captures, not anything made to look like the app), crossing slowly
 * under the headline and the live count. They are pictures moved by CSS
 * alone, so the page costs a slow machine nothing a GPU scene would, and
 * stops with the slide. The walkthrough film is behind the Watch key rather
 * than a second picture: two pictures fought for the page at 800 wide, and
 * the film is the one a press opens as large as the window.
 *
 * The signing says Windows names the publisher and never that Windows stops
 * warning: a new certificate earns that reputation over time, and the page
 * would outlive any promise about it.
 */

const SCENES = [
  { id: 'neon-city', src: sceneNeonCity },
  { id: 'aurora', src: sceneAurora },
  { id: 'alpine', src: sceneAlpine },
];

const FACTS: readonly {
  icon: MenuIconName;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  {
    icon: 'shield',
    title: 'tour.signed.signedTitle',
    body: 'tour.signed.signedBody',
  },
  {
    icon: 'restart',
    title: 'tour.signed.updatesTitle',
    body: 'tour.signed.updatesBody',
  },
  {
    icon: 'gift',
    title: 'tour.signed.freeTitle',
    body: 'tour.signed.freeBody',
  },
];

export default function SignedSlide() {
  const { t, locale } = useTranslation();
  const film = FEATURE_FILMS[WALKTHROUGH_FILM];
  const opener = useRef<HTMLButtonElement>(null);
  const [isFilmOpen, setFilmOpen] = useState(false);
  const watch = `${t('tour.film.watch')}${
    featureFilmLocale(locale, film) === locale
      ? ''
      : ` · ${t('tour.film.englishAudio')}`
  }`;

  return (
    <div className="tour-slide signed-page">
      <section className="signed-page__hero">
        <span className="signed-page__scenes" aria-hidden="true">
          {SCENES.map((scene) => (
            <img
              key={scene.id}
              src={scene.src}
              alt=""
              width={960}
              height={540}
            />
          ))}
        </span>
        <div className="signed-page__headline">
          <span className="signed-page__badge">
            <img src={appIcon} alt="" width={28} height={28} />
            {t('tour.signed.kicker')}
          </span>
          <h3 className="signed-page__title">{t('tour.signed.title')}</h3>
          <p className="signed-page__today">{t('tour.signed.today')}</p>
        </div>
        <SignedCounter />
      </section>

      <div className="signed-page__body">
        <section className="signed-page__road" aria-labelledby="signed-road">
          <h4 className="tour-slide__how-title" id="signed-road">
            {t('tour.signed.roadTitle')}
          </h4>
          <p>{t('tour.signed.intro')}</p>
          <p className="signed-page__thanks">{t('tour.signed.thanks')}</p>
          <button
            ref={opener}
            type="button"
            className="button small signed-page__watch"
            onClick={() => setFilmOpen(true)}
          >
            <PlayerIcon name="play" />
            {watch}
          </button>
        </section>
        <ul className="signed-page__facts">
          {FACTS.map((fact) => (
            <li key={fact.title}>
              <span className="signed-page__fact-icon">
                <MenuIcon name={fact.icon} />
              </span>
              <span>
                <strong>{t(fact.title)}</strong>
                <span>{t(fact.body, { publisher: AUTHOR_NAME })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isFilmOpen && (
        <FeatureFilmLarge
          id={WALKTHROUGH_FILM}
          film={film}
          startAt={0}
          onClose={() => {
            setFilmOpen(false);
            opener.current?.focus();
          }}
        />
      )}
    </div>
  );
}
