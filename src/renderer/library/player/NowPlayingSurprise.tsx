/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useTranslation } from '../../utils/I18nContext';
import { SurpriseIcon, useSurprisePress } from '../LibrarySurpriseButton';

/**
 * Surprise me on the bar, while it plays the Library (Ivan, 2026-11-19:
 * "add the surprise button, only the icon, to the playing bar, only when it's
 * playing from the library ... give it a background, like a ball"). The
 * glyph alone in a ball of the accent, among the bar's toggles; in the
 * options menu a narrow bar folds them into, a row with its name like every
 * other toggle there (`now-playing-bar__option-label`).
 */
const NowPlayingSurprise = () => {
  const { t } = useTranslation();
  const { press, isSparking, sparkEnded } = useSurprisePress();
  const label = t('library.upNext.surprise');
  return (
    <button
      type="button"
      className={`now-playing-bar__toggle now-playing-bar__surprise library-surprise${
        isSparking ? ' is-sparking' : ''
      }`}
      aria-label={label}
      title={label}
      onClick={press}
      onAnimationEnd={sparkEnded}
    >
      <SurpriseIcon />
      <span className="now-playing-bar__option-label">{label}</span>
    </button>
  );
};

export default NowPlayingSurprise;
