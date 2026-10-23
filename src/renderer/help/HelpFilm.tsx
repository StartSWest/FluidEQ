/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties, useRef, useState } from 'react';
import PlayerIcon from '../player/PlayerIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  FEATURE_FILMS,
  featureFilmUrl,
} from '../components/featureTour/featureFilms';
import FILM_POSTERS from '../components/featureTour/filmPosters';
import useFilmLine from '../components/featureTour/useFilmLine';

type TFilmState = 'idle' | 'loading' | 'playing' | 'failed';

/**
 * One of What's New's films in the Help topic it shows (Ivan, 2026-10-15:
 * the films go in Help too). Help's own promise holds: nothing is fetched
 * until the reader presses play, so until then it is a picture bundled with
 * the app. Pressed, it plays with its voice in the reader's language, and
 * the line being said stands under it, as on the What's New slide.
 */
export default function HelpFilm({
  id,
}: {
  /** The film's id in `FEATURE_FILMS`. */
  id: string;
}) {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<TFilmState>('idle');
  // A fresh element on every try, so a retry asks the site again instead of
  // replaying the failure the old element remembers.
  const [attempt, setAttempt] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const film = FEATURE_FILMS[id];
  // A frame of it, bundled, shown until it is pressed.
  const poster = FILM_POSTERS[id];
  const cue = useFilmLine(video, film?.cues ?? [], state === 'playing');
  if (!film || !poster) {
    return null;
  }
  // Its first line says what the feature is: the card's name.
  const title = t(film.cues[0].key);
  const shape = {
    '--film-aspect': film.width / film.height,
  } as CSSProperties;

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="help-film help-film--poster"
        style={shape}
        data-film={id}
        onClick={() => setState('loading')}
        aria-label={t('help.video.play', { title })}
      >
        <span className="help-film__screen">
          <img src={poster} alt="" />
          <span className="help-video__play" aria-hidden="true">
            <PlayerIcon name="play" />
          </span>
        </span>
        <span className="help-film__line">{title}</span>
      </button>
    );
  }

  return (
    <figure className="help-film" style={shape} data-film={id}>
      <div className="help-film__screen">
        {state === 'failed' ? (
          <div className="help-film__failed" role="status">
            <img src={poster} alt="" />
            <p>{t('help.video.failed')}</p>
            <button
              type="button"
              className="button small"
              onClick={() => {
                setAttempt((count) => count + 1);
                setState('loading');
              }}
            >
              {t('help.video.retry')}
            </button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- every line the voice says is the subtitle under the film, in the reader's language, from the dictionary the voice was read from */}
            <video
              key={attempt}
              ref={video}
              src={featureFilmUrl(id, locale)}
              poster={poster}
              controls
              autoPlay
              playsInline
              preload="auto"
              aria-label={title}
              onPlaying={() => setState('playing')}
              onError={() => setState('failed')}
            />
            {state === 'loading' && (
              <span className="help-video__loading" role="status">
                {t('help.video.loading')}
              </span>
            )}
          </>
        )}
      </div>
      {/* Always there, so a line arriving never moves the film above it. */}
      <figcaption className="help-film__line">
        {cue ? <span key={cue.key}>{t(cue.key)}</span> : title}
      </figcaption>
    </figure>
  );
}
