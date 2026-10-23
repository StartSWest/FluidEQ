/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useRef, useState } from 'react';
import PlayerIcon from '../../player/PlayerIcon';
import { useTranslation } from '../../utils/I18nContext';
import FeatureFilmLarge from './FeatureFilmLarge';
import { FEATURE_FILMS } from './featureFilms';

/**
 * A slide's picture, and under it a key that plays the slide's film: the
 * real app, a voice in the reader's language saying what it is and how to
 * use it, and the line being said under the picture, as large as the window
 * allows (`FeatureFilmLarge`).
 *
 * The film is not drawn in the slide. Under the drawing, in the picture's
 * box, it was a narrow crop of the window in the colours it was filmed in,
 * cut off by the stage (Ivan, 2026-10-18: "WTF is this crap"). The picture
 * stays whole, in the reader's own colours, and nothing is fetched until the
 * key is pressed — so a film the site cannot send costs the slide nothing.
 */
interface IFeatureFilmProps {
  /** The slide's id, which names its film. */
  id: string;
  /** The slide's picture, whole, with or without a film. */
  children: ReactNode;
}

export default function FeatureFilm({ id, children }: IFeatureFilmProps) {
  const { t } = useTranslation();
  const film = FEATURE_FILMS[id];
  const opener = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);

  if (!film) {
    return children;
  }
  return (
    <div className="feature-film">
      {children}
      <button
        ref={opener}
        type="button"
        className="button small subtle feature-film__watch"
        onClick={() => setOpen(true)}
      >
        <PlayerIcon name="play" />
        {t('tour.film.watch')}
      </button>
      {isOpen && (
        <FeatureFilmLarge
          id={id}
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
