/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useState,
} from 'react';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import { featureFilmUrl, type IFeatureFilm } from './featureFilms';
import useFilmLine from './useFilmLine';

/**
 * Whether the reader turned the films' sound on. Kept between slides and
 * launches, so a reader who wants to hear them presses once; a film never
 * starts loud on its own (Ivan, 2026-10-14).
 */
const FILM_SOUND_KEY = 'fluideq.tour.filmSound';

export const readFilmSound = (): boolean => {
  try {
    return window.localStorage.getItem(FILM_SOUND_KEY) === 'on';
  } catch {
    return false;
  }
};

const keepFilmSound = (isOn: boolean) => {
  try {
    window.localStorage.setItem(FILM_SOUND_KEY, isOn ? 'on' : 'off');
  } catch {
    // A storage that refuses writes leaves the choice to this film alone.
  }
};

/**
 * A film's picture and the line its voice is saying, in the reader's
 * language: the What's New slide draws it small and the larger view draws it
 * again, from the moment the small one had reached (`startAt`). It loops, as
 * the drawings do, and its sound is the reader's choice, kept between films.
 */
export default function FilmPicture({
  id,
  film,
  video,
  className,
  isShown,
  isSoundOnAtStart,
  startAt = 0,
  onPlaying,
  onFailed,
  children,
}: {
  id: string;
  film: IFeatureFilm;
  video: RefObject<HTMLVideoElement | null>;
  /** The frame's own class: the slide's or the larger view's. */
  className: string;
  isShown: boolean;
  isSoundOnAtStart: boolean;
  /** Seconds into the film to begin at. */
  startAt?: number;
  onPlaying: () => void;
  onFailed: () => void;
  /** Controls drawn over the picture, beside its sound key. */
  children?: ReactNode;
}) {
  const { t, locale } = useTranslation();
  const cue = useFilmLine(video, film.cues, isShown);
  const [isSoundOn, setSoundOn] = useState(isSoundOnAtStart);

  // Set on the element, not as an attribute: React writes `muted` once, when
  // the video is made, and a press must reach the film already playing.
  useEffect(() => {
    if (video.current) {
      video.current.muted = !isSoundOn;
    }
  }, [video, isSoundOn]);

  return (
    <div
      className={`${className}${isShown ? ' is-shown' : ''}`}
      style={{ '--film-aspect': film.width / film.height } as CSSProperties}
    >
      <div
        className="feature-film__screen"
        style={{ aspectRatio: `${film.width} / ${film.height}` }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the voice's lines are the subtitle drawn under the film, in the reader's language, from the same dictionary the voice was read from */}
        <video
          ref={video}
          src={featureFilmUrl(id, locale)}
          muted={!isSoundOn}
          autoPlay
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedMetadata={(event) => {
            if (startAt > 0) {
              // eslint-disable-next-line no-param-reassign -- the element's own position, set once it can take one
              event.currentTarget.currentTime = startAt;
            }
          }}
          onPlaying={onPlaying}
          onError={onFailed}
        />
        {isShown && (
          <div className="feature-film__controls">
            {children}
            <button
              type="button"
              className="button small subtle feature-film__key"
              aria-pressed={isSoundOn}
              aria-label={t(
                isSoundOn ? 'tour.film.soundOff' : 'tour.film.soundOn',
              )}
              title={t(isSoundOn ? 'tour.film.soundOff' : 'tour.film.soundOn')}
              onClick={() => {
                const next = !isSoundOn;
                setSoundOn(next);
                keepFilmSound(next);
              }}
            >
              <PlayerIcon name={isSoundOn ? 'speaker' : 'mute'} />
            </button>
          </div>
        )}
      </div>
      {/* Always there, so a line arriving never moves the picture above. */}
      <p className="feature-film__subtitle">
        {cue && <span key={cue.key}>{t(cue.key)}</span>}
      </p>
    </div>
  );
}
