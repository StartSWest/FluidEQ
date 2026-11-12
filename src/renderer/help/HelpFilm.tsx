/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, useRef, useState } from 'react';
import PlayerIcon from '../player/PlayerIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  FEATURE_FILMS,
  featureFilmLocale,
  type IFeatureFilm,
} from '../components/featureTour/featureFilms';
import FILM_POSTERS from '../components/featureTour/filmPosters';
import useFilmPlayback from '../components/featureTour/useFilmPlayback';

type TFilmState = 'loading' | 'playing' | 'failed';

interface IPlaybackProps {
  id: string;
  film: IFeatureFilm;
  poster: string;
  title: string;
  audioNote?: string;
  onRetry: () => void;
}

// Mounted only after Play. A retry mounts afresh, so neither a failed source
// nor its stand-in and timing track can survive into the next attempt.
function HelpFilmPlayback({
  id,
  film,
  poster,
  title,
  audioNote,
  onRetry,
}: IPlaybackProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<TFilmState>('loading');
  const video = useRef<HTMLVideoElement>(null);
  const playback = useFilmPlayback(id, film, video, state === 'playing', () =>
    setState('failed'),
  );
  return (
    <figure
      className="help-film"
      style={{ '--film-aspect': film.width / film.height } as CSSProperties}
      data-film={id}
    >
      <div className="help-film__screen">
        {state === 'failed' ? (
          <div className="help-film__failed" role="status">
            <img src={poster} alt="" />
            <p>{t('help.video.failed')}</p>
            <button type="button" className="button small" onClick={onRetry}>
              {t('help.video.retry')}
            </button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- shared playback draws translated lines or the stand-in's captions below the film */}
            <video
              ref={video}
              src={playback.src}
              crossOrigin={playback.crossOrigin}
              poster={poster}
              controls
              autoPlay
              playsInline
              preload="auto"
              aria-label={title}
              onPlaying={() => setState('playing')}
              onError={playback.onError}
            >
              {playback.tracks}
            </video>
            {state === 'loading' && (
              <span className="help-video__loading" role="status">
                {t('help.video.loading')}
              </span>
            )}
          </>
        )}
      </div>
      <figcaption className="help-film__line">
        <span key={playback.subtitle}>{playback.subtitle || title}</span>
        {audioNote && <span>{audioNote}</span>}
      </figcaption>
    </figure>
  );
}

/** A bundled poster until Play; Help and What's New share subtitles and fallback. */
export default function HelpFilm({ id }: { id: string }) {
  const { t, locale } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const film = FEATURE_FILMS[id];
  const poster = FILM_POSTERS[id];
  if (!film || !poster) {
    return null;
  }
  const title = t(film.cues[0].key);
  const audioNote =
    featureFilmLocale(locale, film) !== locale
      ? t('tour.film.englishAudio')
      : undefined;
  if (pressed) {
    return (
      <HelpFilmPlayback
        key={attempt}
        id={id}
        film={film}
        poster={poster}
        title={title}
        audioNote={audioNote}
        onRetry={() => setAttempt((count) => count + 1)}
      />
    );
  }
  return (
    <button
      type="button"
      className="help-film help-film--poster"
      style={{ '--film-aspect': film.width / film.height } as CSSProperties}
      data-film={id}
      onClick={() => setPressed(true)}
      aria-label={[t('help.video.play', { title }), audioNote]
        .filter(Boolean)
        .join('. ')}
    >
      <span className="help-film__screen">
        <img src={poster} alt="" />
        <span className="help-video__play" aria-hidden="true">
          <PlayerIcon name="play" />
        </span>
      </span>
      <span className="help-film__line">
        {title}
        {audioNote && <span>{audioNote}</span>}
      </span>
    </button>
  );
}
