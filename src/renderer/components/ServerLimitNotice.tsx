/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { openAdminSection } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useSceneReview } from '../plus/sceneReviewStore';
import {
  checkServerLimit,
  LIMIT_NAMES,
  LIMIT_TITLES,
  putAwayServerLimit,
  shownLevel,
  useServerLimit,
} from '../plus/serverLimit';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/SceneReviewNotice.scss';

/**
 * The admin told, in the corner, that the server is nearing a limit of
 * Supabase's free plan: which limit, how full, and the way to the Server
 * page, where Supabase is one press away. Amber from 60%, red from 85%.
 *
 * Only the admin is ever measured: the review notice's state carries the
 * admin's queue length and nobody else's (`plusReview.ts`), so that is what
 * says this account is the admin before anything is asked of the server.
 * Put away, it stays away for the session unless the limit gets worse.
 *
 * The scene review notice's card and corner, as the maker's month borrows
 * them: one place for news about the account, one card at a time.
 */
export default function ServerLimitNotice() {
  const { t, locale } = useTranslation();
  const review = useSceneReview();
  const limit = useServerLimit();
  const isAdmin =
    review.accountId !== undefined && review.waiting !== undefined;

  useEffect(() => {
    if (isAdmin && review.accountId) {
      checkServerLimit(review.accountId).catch(() => undefined);
    }
  }, [isAdmin, review.accountId]);

  const level = shownLevel(limit);
  const wanted =
    isAdmin &&
    limit.accountId === review.accountId &&
    level !== 'ok' &&
    !(limit.putAwayAt === 'full' || limit.putAwayAt === level);
  const isShown = useNoticeTurn('serverLimit', wanted);

  if (!wanted || !isShown || !limit.nearest) {
    return null;
  }

  return (
    <CompactFrame
      className="scene-review-notice server-limit-notice"
      tone={level === 'full' ? 'danger' : 'warn'}
      icon={<MenuIcon name="alert" />}
      title={t(LIMIT_TITLES[level])}
      titleId="server-limit-notice-title"
      role="dialog"
      aria-modal="false"
      onClose={putAwayServerLimit}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={putAwayServerLimit}
          >
            {t('insights.server.limit.later')}
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => {
              putAwayServerLimit();
              openAdminSection('server');
              requestPlusTab();
            }}
          >
            {t('insights.server.limit.open')}
          </button>
        </>
      }
    >
      <p className="scene-review-notice__line">
        {t('insights.server.limit.body', {
          what: t(LIMIT_NAMES[limit.nearest.limit]),
          share: new Intl.NumberFormat(locale, { style: 'percent' }).format(
            limit.nearest.share,
          ),
        })}
      </p>
    </CompactFrame>
  );
}
