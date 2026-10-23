/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import FilmPicture from './FilmPicture';
import type { IFeatureFilm } from './featureFilms';

/**
 * A slide's film as large as the window allows, opened by a press on the
 * slide's copy and starting where it was, with its sound on: a press is the
 * reader asking to watch it. On the page itself, not inside the What's New
 * dialog — the dialog's frosted backdrop makes it the box anything fixed in
 * it is placed in, and a film there could never be larger than the dialog.
 * Escape, the close key or a press beside the film puts the slide back.
 */
export default function FeatureFilmLarge({
  id,
  film,
  startAt,
  onClose,
}: {
  id: string;
  film: IFeatureFilm;
  startAt: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [isShown, setShown] = useState(false);

  // The close key is drawn with the film's other keys, once it plays.
  useEffect(() => {
    if (isShown) {
      close.current?.focus();
    }
  }, [isShown]);

  useEffect(() => {
    // In the capture phase and stopped there: the What's New dialog closes on
    // Escape too, and one press must close only the film.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="feature-film-large"
      role="dialog"
      aria-modal="true"
      aria-label={t(film.cues[0].key)}
    >
      {/* The pointer's way out, beside the film; Escape and the close key are
          the keyboard's, so this is hidden from it and from a screen reader. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape and the close key already close it from the keyboard */}
      <div
        className="feature-film-large__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <FilmPicture
        id={id}
        film={film}
        video={video}
        className="feature-film__frame feature-film-large__frame"
        isShown={isShown}
        isSoundOnAtStart
        startAt={startAt}
        onPlaying={() => setShown(true)}
        onFailed={onClose}
      >
        <button
          ref={close}
          type="button"
          className="button small subtle feature-film__key"
          aria-label={t('tour.film.close')}
          title={t('tour.film.close')}
          onClick={onClose}
        >
          <PlayerIcon name="close" />
        </button>
      </FilmPicture>
    </div>,
    document.body,
  );
}
