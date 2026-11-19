/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { GUEST_TINT_SITES } from './guestTint';
import {
  setGuestTintEnabled,
  useGuestTintEnabled,
} from './guestTintPreference';

/**
 * The switch for showing the site in FluidEQ's colours, a row in the rail's
 * foot (`VideoRail`): the drop and the words, and "On" at the row's end while
 * it is, the drop filled in the accent. It was a lone drop at the end of the
 * toolbar, its words only in a tooltip. On a site this cannot tint it stays
 * where it is and says why, rather than vanishing from under the pointer -
 * the choice is remembered and comes back with the next site that can take
 * it.
 */
const GuestTintToggle = ({ siteId }: { siteId: string | undefined }) => {
  const { t } = useTranslation();
  const isOn = useGuestTintEnabled();
  const canTint = siteId !== undefined && siteId in GUEST_TINT_SITES;
  const isLit = isOn && canTint;
  return (
    <button
      type="button"
      className={`video-rail__item video-rail__match${isLit ? ' is-on' : ''}`}
      aria-pressed={isOn}
      // Its name whether or not the folded rail shows the words.
      aria-label={t('video.matchColours')}
      title={t(
        canTint ? 'video.matchColoursHint' : 'video.matchColoursUnavailable',
      )}
      disabled={!canTint}
      onClick={() => setGuestTintEnabled(!isOn)}
    >
      <svg className="video-rail__icon" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2.1c-1.9 2.2-4.4 5.2-4.4 7.5a4.4 4.4 0 0 0 8.8 0C12.4 7.3 9.9 4.3 8 2.1z" />
      </svg>
      <span className="video-rail__label studio-rail__word">
        {t('video.matchColours')}
      </span>
      {isLit && (
        // The pressed state says it to a screen reader already.
        <small className="video-rail__state studio-rail__word" aria-hidden>
          {t('video.matchOn')}
        </small>
      )}
    </button>
  );
};

export default GuestTintToggle;
