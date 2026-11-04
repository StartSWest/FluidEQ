/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import {
  featureFilmTimingUrl,
  featureFilmUrl,
  type IFeatureFilm,
  type IFilmCue,
  siteCues,
} from './featureFilms';
import useFilmLine from './useFilmLine';

const NO_LINES: readonly IFilmCue[] = [];

/** Shared by Help and What's New: site timings and a stand-in must never drift between readers. Mount only once the reader asks to play. */
export default function useFilmPlayback(
  id: string,
  film: IFeatureFilm,
  video: RefObject<HTMLVideoElement | null>,
  isShown: boolean,
  onFailed: () => void,
) {
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

  // Metadata timings can be updated beside the recording without an app release.
  useEffect(() => {
    const element = track.current;
    if (!element) {
      return undefined;
    }
    const read = () => setTimed(siteCues(film, element.track.cues));
    element.addEventListener('load', read);
    return () => element.removeEventListener('load', read);
  }, [film, timing]);

  return {
    src: standIn?.src ?? featureFilmUrl(id, locale),
    crossOrigin: timing || standIn ? ('anonymous' as const) : undefined,
    subtitle: standIn ? standInLine : cue && t(cue.key),
    onError: () => {
      if (film.standIn && !isStandIn) {
        setStandIn(true);
      } else {
        onFailed();
      }
    },
    tracks: standIn ? (
      <track
        ref={standInTrack}
        kind="captions"
        src={standIn.captions}
        srcLang="en"
        default
      />
    ) : (
      timing && <track ref={track} kind="metadata" src={timing} default />
    ),
  };
}
