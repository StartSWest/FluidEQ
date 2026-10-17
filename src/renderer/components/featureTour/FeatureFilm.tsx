/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useEffect, useRef, useState } from 'react';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import { prefersReducedMotion } from '../../utils/bandReveal';
import FeatureFilmLarge from './FeatureFilmLarge';
import FilmPicture, { readFilmSound } from './FilmPicture';
import { FEATURE_FILMS } from './featureFilms';

/**
 * A slide's film, played in place of its drawing: the real app, a voice in
 * the reader's language saying what it is and how to use it, and the line
 * being said shown under the picture.
 *
 * The drawing stays until the film is actually playing, and stays for good
 * when there is no film for the slide, when the site cannot be reached, or
 * when motion is reduced — so a slide never shows a black box or a spinner.
 * The film plays muted on a loop, as the drawings loop, and starts by itself
 * (Ivan, 2026-10-14), which the terms say (`terms.elsewhere.p10`); the
 * subtitle says what the voice would, so a muted film still explains itself.
 *
 * In the slide's picture box a film shot wide is too small to read the app
 * in, so a press opens it larger over the window, from where it was, with
 * its sound (`FeatureFilmLarge`); the slide's copy waits paused meanwhile.
 */
interface IFeatureFilmProps {
  /** The slide's id, which names its film. */
  id: string;
  /** The drawing: shown before the film plays, and instead of it. */
  children: ReactNode;
}

export default function FeatureFilm({ id, children }: IFeatureFilmProps) {
  const { t } = useTranslation();
  const film = FEATURE_FILMS[id];
  const video = useRef<HTMLVideoElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<'loading' | 'playing' | 'failed'>(
    'loading',
  );
  // Where the larger view was opened from, in seconds; none while closed.
  const [largeFrom, setLargeFrom] = useState<number | undefined>();
  const [isSoundOnAtStart] = useState(readFilmSound);

  // The slide's copy pauses under the larger one and plays on after it.
  useEffect(() => {
    const element = video.current;
    if (!element || state !== 'playing') {
      return;
    }
    if (largeFrom === undefined) {
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [largeFrom, state]);

  if (!film || state === 'failed' || prefersReducedMotion()) {
    return children;
  }
  return (
    <div className="feature-film">
      {state !== 'playing' && (
        <div className="feature-film__drawing">{children}</div>
      )}
      <FilmPicture
        id={id}
        film={film}
        video={video}
        className="feature-film__frame"
        isShown={state === 'playing'}
        isSoundOnAtStart={isSoundOnAtStart}
        onPlaying={() => setState('playing')}
        onFailed={() => setState('failed')}
      >
        <button
          ref={opener}
          type="button"
          className="button small subtle feature-film__key"
          aria-label={t('tour.film.enlarge')}
          title={t('tour.film.enlarge')}
          onClick={() => setLargeFrom(video.current?.currentTime ?? 0)}
        >
          <PlayerIcon name="expand" />
        </button>
      </FilmPicture>
      {largeFrom !== undefined && (
        <FeatureFilmLarge
          id={id}
          film={film}
          startAt={largeFrom}
          onClose={() => {
            setLargeFrom(undefined);
            opener.current?.focus();
          }}
        />
      )}
    </div>
  );
}
