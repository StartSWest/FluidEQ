/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { AnimationEvent, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';

/** The spark's keyframes (`_libraryUpNext.scss`), the one animation here. */
const SPARK_ANIMATION = 'library-surprise-spark';

/**
 * Two crossing arrows, the shuffle every player draws, with a spark at
 * their start. The arrows say `fill="none"` on themselves: `.button` inks
 * every filled path in a button dark, and an arrow drawn as a stroke would
 * otherwise carry a dark blob in its bend. The spark is the one filled
 * shape, and takes that ink.
 */
const SurpriseIcon = () => (
  <svg className="library-surprise__icon" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="none"
      d="M3.5 18.5h2.6c4.4 0 6.4-10 10.8-10h3.6M18 6l2.5 2.5L18 11M3.5 8.5h2.6c1.6 0 2.8.9 3.8 2.3M12.3 15.6c1.1 1.6 2.5 2.9 4.6 2.9h3.6M18 16l2.5 2.5L18 21"
    />
    <path
      className="library-surprise__spark"
      d="M6 1.8Q6.3 4 8.5 4.3 6.3 4.6 6 6.8 5.7 4.6 3.5 4.3 5.7 4 6 1.8z"
    />
  </svg>
);

/**
 * Surprise me: a random song from the whole library starts now, and Up Next
 * carries on in its style (`useSurprise`). A press again changes the song,
 * and the genre when the library has another.
 *
 * Drawn in two places in Up Next — beside Keep playing, and larger in an
 * empty queue — and `className` only ever says which. The spark turns on
 * the press itself, before the library has answered, so the press is seen
 * the moment it lands; the draw over the shelf follows the song.
 */
const LibrarySurpriseButton = ({
  className,
  title,
  onAnswer,
}: {
  className: string;
  title?: string;
  /** The song started, or null when the library had nothing to play. */
  onAnswer?: (picked: string | null) => void;
}) => {
  const { t } = useTranslation();
  const { surprise } = useLibraryPlayerSession();
  const [isSparking, setIsSparking] = useState(false);
  const press = () => {
    setIsSparking(true);
    surprise()
      .then((picked) => onAnswer?.(picked))
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; nothing starts and the button stays
        console.error(
          'Surprise me could not ask the library for a song',
          error,
        );
      });
  };
  const sparkEnded = (event: AnimationEvent<HTMLButtonElement>) => {
    if (event.animationName === SPARK_ANIMATION) {
      setIsSparking(false);
    }
  };
  return (
    <button
      type="button"
      className={`button library-surprise ${className}${
        isSparking ? ' is-sparking' : ''
      }`}
      title={title}
      onClick={press}
      onAnimationEnd={sparkEnded}
    >
      <SurpriseIcon />
      <span>{t('library.upNext.surprise')}</span>
    </button>
  );
};

export default LibrarySurpriseButton;
