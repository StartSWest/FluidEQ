/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import {
  makerMonthDaysLeft,
  makerMonthEndsToday,
  makerMonthState,
} from 'common/makerMonth';
import Glyph from '../community/Glyph';
import { useAccount } from '../account/accountStore';
import { loadMakerMonth, useMakerMonth } from '../plus/makerMonthStore';
import { openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useTranslation } from '../utils/I18nContext';
import '../styles/SceneReviewNotice.scss';

/**
 * The week's warning before a maker's earned Plus runs out, and the word on
 * the day it does.
 *
 * It has to exist. An earned month is not a subscription — nothing renews it
 * and no card is charged — so without this the Plus a maker worked for simply
 * vanishes one morning with no warning, which is the kind of silence people
 * never forgive. Publishing a scene before then earns the next month, and the
 * notice is also what brings them back to the Studio.
 *
 * Only ever shown to somebody who has had a scene approved: for anybody else
 * there is no month to lose. Once per state per session, beside the work and
 * never in front of it, in the corner the review news already uses.
 */

type TShown = 'ending' | 'ended';

const seenKey = (accountId: string, which: TShown) =>
  `fluideq.makerMonth.${which}.${accountId}`;

/**
 * Whether this window has already said it. `sessionStorage`, because the
 * point is to say it once a sitting rather than once ever: somebody who has
 * not published by tomorrow should hear it again.
 */
const alreadySaid = (accountId: string, which: TShown): boolean => {
  try {
    return sessionStorage.getItem(seenKey(accountId, which)) === 'yes';
  } catch {
    return false;
  }
};

const rememberSaid = (accountId: string, which: TShown) => {
  try {
    sessionStorage.setItem(seenKey(accountId, which), 'yes');
  } catch {
    // A window with no storage says it again; that is the harmless direction.
  }
};

export default function MakerMonthNotice() {
  const { t } = useTranslation();
  const { identity, status } = useAccount();
  const accountId = status === 'signed-in' ? identity?.id : undefined;
  const { month, accountId: asked } = useMakerMonth();
  const [putAway, setPutAway] = useState<TShown | undefined>();

  useEffect(() => {
    if (accountId) {
      loadMakerMonth(accountId).catch(() => undefined);
    }
  }, [accountId]);

  if (!accountId || !month || asked !== accountId || !month.maker) {
    return null;
  }
  const state = makerMonthState(month, Date.now());
  const which: TShown | undefined =
    state === 'ending' || state === 'ended' ? state : undefined;
  if (!which || putAway === which || alreadySaid(accountId, which)) {
    return null;
  }

  const days = makerMonthDaysLeft(month, Date.now());
  // The last day is "today" or "tomorrow", neither of which carries a
  // number: "ends in 1 days" is the sentence this avoids, and so is
  // "tomorrow" said on the morning it ends.
  const title = () => {
    if (which === 'ended') {
      return t('account.maker.notice.endedTitle');
    }
    if (makerMonthEndsToday(month, Date.now())) {
      return t('account.maker.notice.endingToday');
    }
    return days <= 1
      ? t('account.maker.notice.endingTomorrow')
      : t('account.maker.notice.endingTitle', { days: String(days) });
  };
  const close = () => {
    rememberSaid(accountId, which);
    setPutAway(which);
  };
  const open = () => {
    close();
    openPlusPlace('studio');
    requestPlusTab();
  };

  return (
    <div
      className="scene-review-notice scene-review-notice--waiting maker-month-notice"
      role="dialog"
      aria-labelledby="maker-month-notice-title"
    >
      <div className="scene-review-notice__body">
        <span className="scene-review-notice__mark" aria-hidden="true">
          <Glyph name="calendar" />
        </span>
        <div className="scene-review-notice__text">
          <strong id="maker-month-notice-title">{title()}</strong>
          <p className="scene-review-notice__line">
            {t(
              which === 'ended'
                ? 'account.maker.notice.endedBody'
                : 'account.maker.notice.endingBody',
            )}
          </p>
        </div>
      </div>
      <div className="scene-review-notice__actions">
        <button type="button" className="button small subtle" onClick={close}>
          {t('account.maker.notice.later')}
        </button>
        <button type="button" className="button small" onClick={open}>
          {t('account.maker.notice.open')}
        </button>
      </div>
    </div>
  );
}
