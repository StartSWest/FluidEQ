/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { formatDollars, payoutShort, payoutSoon } from 'common/creatorPayouts';
import MenuIcon from '../icons/MenuIcon';
import {
  checkPayoutDue,
  putAwayPayoutDue,
  usePayoutDue,
} from '../plus/payoutDue';
import { openAdminSection } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useSceneReview } from '../plus/sceneReviewStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/SceneReviewNotice.scss';

/**
 * The admin told, in the corner, what the next automatic payout will send:
 * in the three days before it, how much to how many creators and on what
 * day, and in amber when FluidEQ's Stripe balance is short of it. Payouts run
 * by themselves on the 1st and the 16th (Ivan, 2026-10-21: "payout should
 * happen auto"); the Payouts page is one press away.
 *
 * Only the admin is asked: the review notice's state carries the admin's
 * queue length and nobody else's, which is what says whom this is for before
 * anything is asked of the server — as `ServerLimitNotice` does.
 */
export default function PayoutDueNotice() {
  const { t, locale } = useTranslation();
  const review = useSceneReview();
  const due = usePayoutDue();
  const isAdmin =
    review.accountId !== undefined && review.waiting !== undefined;

  useEffect(() => {
    if (isAdmin && review.accountId) {
      checkPayoutDue(review.accountId).catch(() => undefined);
    }
  }, [isAdmin, review.accountId]);

  const preview =
    isAdmin && due.accountId === review.accountId ? due.preview : undefined;
  const wanted =
    preview !== undefined && !due.putAway && payoutSoon(preview, Date.now());
  const isShown = useNoticeTurn('payoutDue', wanted);

  if (!wanted || !isShown || !preview) {
    return null;
  }

  const short = payoutShort(preview);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    preview.nextRunAt ?? Date.now(),
  );

  const open = () => {
    putAwayPayoutDue();
    openAdminSection('payouts');
    requestPlusTab();
  };

  return (
    <CompactFrame
      className="scene-review-notice payout-due-notice"
      tone={short ? 'warn' : 'accent'}
      icon={<MenuIcon name={short ? 'alert' : 'credit'} />}
      title={t(short ? 'creator.notice.shortTitle' : 'creator.notice.title', {
        date: day,
      })}
      titleId="payout-due-notice-title"
      role="dialog"
      aria-modal="false"
      onClose={putAwayPayoutDue}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={putAwayPayoutDue}
          >
            {t('creator.notice.later')}
          </button>
          <button type="button" className="button small" onClick={open}>
            {t('creator.notice.open')}
          </button>
        </>
      }
    >
      <p className="scene-review-notice__line">
        {t(short ? 'creator.notice.shortBody' : 'creator.notice.body', {
          amount: formatDollars(preview.totalCents, locale),
          count: new Intl.NumberFormat(locale).format(preview.due.length),
          available: formatDollars(preview.availableCents ?? 0, locale),
        })}
      </p>
    </CompactFrame>
  );
}
