/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { formatDollars, payoutRunDue } from 'common/creatorPayouts';
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
 * The admin told, in the corner, that creators are owed their payout run:
 * somebody is due and the last run is 15 days behind, or there has never
 * been one. The way to the Payouts page is the loud press; the run itself is
 * still made there, asked twice.
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
    preview !== undefined && !due.putAway && payoutRunDue(preview, Date.now());
  const isShown = useNoticeTurn('payoutDue', wanted);

  if (!wanted || !isShown || !preview) {
    return null;
  }

  const open = () => {
    putAwayPayoutDue();
    openAdminSection('payouts');
    requestPlusTab();
  };

  return (
    <CompactFrame
      className="scene-review-notice payout-due-notice"
      tone="accent"
      icon={<MenuIcon name="credit" />}
      title={t('creator.notice.title')}
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
        {t('creator.notice.body', {
          amount: formatDollars(preview.totalCents, locale),
          count: new Intl.NumberFormat(locale).format(preview.due.length),
          // A server from before the interval names none; it promised 15.
          every: String(preview.payoutDays ?? 15),
        })}
      </p>
    </CompactFrame>
  );
}
