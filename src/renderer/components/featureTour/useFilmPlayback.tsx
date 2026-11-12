/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import {
  featureFilmCaptionUrls,
  featureFilmLocale,
  featureFilmUrl,
  type IFeatureFilm,
  type IFilmCue,
} from './featureFilms';
import useFilmLine from './useFilmLine';

const NO_LINES: readonly IFilmCue[] = [];

/** Shared by Help and What's New: site subtitles and a stand-in must never drift between readers. Mount only once the reader asks to play. */
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
  // Verbatim subtitles: the reader's language if the site has it, else the
  // voice's (`featureFilmCaptionUrls`); a track the site refuses moves on to
  // the next on its own `error`.
  // The count of refusals belongs to one film in one language, so another
  // language starts again from its own.
  const captionUrls = featureFilmCaptionUrls(id, locale);
  const captionScope = `${id}.${locale}`;
  const [refused, setRefused] = useState({ scope: captionScope, count: 0 });
  const captionTry = Math.min(
    refused.scope === captionScope ? refused.count : 0,
    captionUrls.length - 1,
  );
  const captionSrc =
    standIn?.captions ??
    (film.spokenCaptions ? captionUrls[captionTry] : undefined);
  const hasNextCaption = !standIn && captionTry < captionUrls.length - 1;
  // The reader's own language until it is refused, then the voice's.
  const captionLanguage =
    captionUrls.length > 1 && captionTry === 0
      ? locale
      : featureFilmLocale(locale, film);
  const isBundled =
    !standIn && !!film.bundled?.[featureFilmLocale(locale, film)];
  const cue = useFilmLine(
    video,
    standIn || film.spokenCaptions ? NO_LINES : film.cues,
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
    const next = () => {
      if (hasNextCaption) {
        setRefused({ scope: captionScope, count: captionTry + 1 });
      }
    };
    element.addEventListener('cuechange', read);
    element.addEventListener('error', next);
    return () => {
      element.removeEventListener('cuechange', read);
      element.removeEventListener('error', next);
    };
  }, [captionSrc, hasNextCaption, captionScope, captionTry]);

  return {
    src: standIn?.src ?? featureFilmUrl(id, locale),
    crossOrigin: !isBundled && captionSrc ? ('anonymous' as const) : undefined,
    subtitle: captionSrc ? standInLine : cue && t(cue.key),
    onError: () => {
      if (film.standIn && !isStandIn) {
        setStandIn(true);
      } else {
        onFailed();
      }
    },
    tracks: captionSrc ? (
      <track
        // A new element for each source: a track that failed once is not
        // loaded again by changing its src.
        key={captionSrc}
        ref={standInTrack}
        kind="captions"
        src={captionSrc}
        srcLang={standIn ? 'en' : captionLanguage}
        default
      />
    ) : undefined,
  };
}
