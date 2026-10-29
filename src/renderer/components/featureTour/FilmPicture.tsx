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
  useRef,
  useState,
} from 'react';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  featureFilmTimingUrl,
  featureFilmUrl,
  type IFeatureFilm,
  type IFilmCue,
  siteCues,
} from './featureFilms';
import FILM_POSTERS from './filmPosters';
import useFilmLine from './useFilmLine';

/** A stand-in's lines are its own captions, on the picture. */
const NO_LINES: readonly IFilmCue[] = [];

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
  notice,
  children,
}: {
  id: string;
  film: IFeatureFilm;
  video: RefObject<HTMLVideoElement | null>;
  /** The frame's own class: the slide's or the larger view's. */
  className: string;
  /** Playing: its keys are drawn and its lines said under it. */
  isShown: boolean;
  isSoundOnAtStart: boolean;
  /** Seconds into the film to begin at. */
  startAt?: number;
  onPlaying: () => void;
  onFailed: () => void;
  /**
   * Said under the picture in place of the voice's lines: why there is no
   * film to watch. Nothing is heard then, so there is no sound key either.
   */
  notice?: string;
  /** Controls drawn over the picture, beside its sound key. */
  children?: ReactNode;
}) {
  const { t, locale } = useTranslation();
  // Set once the film itself could not be loaded and it has a stand-in; a
  // stand-in that fails too is the film failing.
  const [isStandIn, setStandIn] = useState(false);
  const standIn = isStandIn ? film.standIn : undefined;
  const timing =
    film.timedOnSite && !standIn ? featureFilmTimingUrl(id, locale) : undefined;
  const track = useRef<HTMLTrackElement>(null);
  const [timed, setTimed] = useState<readonly IFilmCue[] | undefined>();
  const cue = useFilmLine(
    video,
    standIn ? NO_LINES : (timed ?? film.cues),
    isShown,
  );
  const [isSoundOn, setSoundOn] = useState(isSoundOnAtStart);
  const standInTrack = useRef<HTMLTrackElement>(null);
  const [standInLine, setStandInLine] = useState('');

  // A stand-in's captions are said in the line under the picture, as every
  // film's lines are, not drawn over it: kept hidden, read as each cue
  // starts and ends (the track element hears `cuechange` as its track does).
  useEffect(() => {
    const element = standInTrack.current;
    if (!element) {
      return undefined;
    }
    if (element.track) {
      element.track.mode = 'hidden';
    }
    const read = () =>
      setStandInLine(
        Array.from(element.track?.activeCues ?? [])
          .map((cue) =>
            'text' in cue && typeof cue.text === 'string' ? cue.text : '',
          )
          .join(' '),
      );
    element.addEventListener('cuechange', read);
    return () => element.removeEventListener('cuechange', read);
  }, [standIn]);

  // Set on the element, not as an attribute: React writes `muted` once, when
  // the video is made, and a press must reach the film already playing.
  useEffect(() => {
    if (video.current) {
      video.current.muted = !isSoundOn;
    }
  }, [video, isSoundOn]);

  // A metadata track marked default loads by itself, hidden; its cues are
  // read once it has.
  useEffect(() => {
    const element = track.current;
    if (!element) {
      return undefined;
    }
    const read = () => setTimed(siteCues(film, element.track.cues));
    element.addEventListener('load', read);
    return () => element.removeEventListener('load', read);
  }, [film, timing]);

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
          src={standIn?.src ?? featureFilmUrl(id, locale)}
          // A track from the site is read across origins only with the site's
          // grant, which /video/ sends; without the attribute the browser
          // refuses the track and the film plays on its own timings.
          crossOrigin={timing || standIn ? 'anonymous' : undefined}
          // A frame of the film, bundled, until the site's first picture.
          poster={FILM_POSTERS[id]}
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
          onError={() => {
            if (film.standIn && !isStandIn) {
              setStandIn(true);
            } else {
              onFailed();
            }
          }}
        >
          {standIn ? (
            <track
              ref={standInTrack}
              kind="captions"
              src={standIn.captions}
              srcLang="en"
              default
            />
          ) : (
            timing && <track ref={track} kind="metadata" src={timing} default />
          )}
        </video>
        {isShown && (
          <div className="feature-film__controls">
            {children}
            {notice === undefined && (
              <button
                type="button"
                className="button small subtle feature-film__key"
                aria-pressed={isSoundOn}
                aria-label={t(
                  isSoundOn ? 'tour.film.soundOff' : 'tour.film.soundOn',
                )}
                title={t(
                  isSoundOn ? 'tour.film.soundOff' : 'tour.film.soundOn',
                )}
                onClick={() => {
                  setSoundOn(!isSoundOn);
                }}
              >
                <PlayerIcon name={isSoundOn ? 'speaker' : 'mute'} />
              </button>
            )}
          </div>
        )}
      </div>
      {/* Always there, so a line arriving never moves the picture above. */}
      <p className="feature-film__subtitle">
        {notice !== undefined && <span role="status">{notice}</span>}
        {notice === undefined && standIn && standInLine && (
          <span key={standInLine}>{standInLine}</span>
        )}
        {notice === undefined && !standIn && cue && (
          <span key={cue.key}>{t(cue.key)}</span>
        )}
      </p>
    </div>
  );
}
