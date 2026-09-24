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
 * The Media bar's switch for showing the site in FluidEQ's colours.
 *
 * A mark and not a sentence, like everything else in that bar: a drop that
 * fills with the accent while it is on. The words are the tooltip and the
 * name a screen reader hears. On a site this cannot tint it stays where it is
 * and says why, rather than vanishing from under the pointer — the choice is
 * remembered and comes back with the next site that can take it.
 */
const GuestTintToggle = ({ siteId }: { siteId: string | undefined }) => {
  const { t } = useTranslation();
  const isOn = useGuestTintEnabled();
  const canTint = siteId !== undefined && siteId in GUEST_TINT_SITES;
  return (
    <button
      type="button"
      className={`video-browser__match${isOn && canTint ? ' is-on' : ''}`}
      aria-pressed={isOn}
      aria-label={t('video.matchColours')}
      title={t(
        canTint ? 'video.matchColoursHint' : 'video.matchColoursUnavailable',
      )}
      disabled={!canTint}
      onClick={() => setGuestTintEnabled(!isOn)}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2.1c-1.9 2.2-4.4 5.2-4.4 7.5a4.4 4.4 0 0 0 8.8 0C12.4 7.3 9.9 4.3 8 2.1z" />
      </svg>
    </button>
  );
};

export default GuestTintToggle;
