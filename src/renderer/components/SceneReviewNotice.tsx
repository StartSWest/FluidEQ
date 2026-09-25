/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties, ReactNode } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { TSceneReviewNotice } from 'common/sceneReviewNotice';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import {
  openAdminSection,
  openGalleryPage,
  openPlusPlace,
} from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { REJECT_REASON_LABELS } from '../plus/ReviewDecision';
import { markSceneReviewSeen, useSceneReview } from '../plus/sceneReviewStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import '../styles/SceneReviewNotice.scss';

const MARKS: Record<TSceneReviewNotice['kind'], TCommunityGlyph> = {
  waiting: 'check',
  approved: 'check',
  rejected: 'alert',
};

/**
 * News about scenes under review, in the corner: the admin told that a scene
 * waits for them, a maker told that theirs was approved or not and why.
 *
 * Mounted at the app root beside the terms notice, because the news can land
 * on any tab and the person it is for need never open the Plus tab to hear
 * it. Beside the work, never in front of it: nothing here must be answered
 * before anything else can happen, so it takes no focus and blocks nothing.
 * The way to the thing it is about wears the loud style; putting it away is
 * the quiet one, and either marks it told.
 *
 * Each notice carries its scene's own colours down its edge, so a maker knows
 * which scene it is before reading a word.
 *
 * Whether it shows is decided in the main process (`common/sceneReviewNotice`).
 */
export default function SceneReviewNotice() {
  const { t, locale } = useTranslation();
  const { notice } = useSceneReview();
  // After the terms notice, and after everything that notice steps aside for
  // (`noticeTurn.ts`).
  const isShown = useNoticeTurn('sceneReview', Boolean(notice));

  if (!notice || !isShown) {
    return null;
  }

  const putAway = () => {
    markSceneReviewSeen(notice.keys).catch(() => undefined);
  };

  const go = (open: () => void) => {
    putAway();
    open();
    requestPlusTab();
  };

  const swatch =
    notice.kind === 'waiting' ? notice.newest.swatch : notice.swatch;
  const edge = {
    '--scene-review-edge': `linear-gradient(180deg, ${swatch.join(', ')})`,
  } as CSSProperties;

  let title: string;
  let body: ReactNode = null;
  let action: { label: string; run: () => void };
  let quiet = t('review.notice.gotIt');

  if (notice.kind === 'waiting') {
    const name = resolveSceneName(notice.newest, locale);
    title =
      notice.count === 1
        ? t('review.notice.waitingOne')
        : t('review.notice.waitingMany', { count: String(notice.count) });
    body = (
      <p className="scene-review-notice__line">
        {t(
          notice.count === 1
            ? 'review.notice.waitingWho'
            : 'review.notice.waitingNewest',
          {
            name,
            maker: notice.newest.authorName ?? t('plus.card.anonymous'),
          },
        )}
      </p>
    );
    quiet = t('review.notice.later');
    action = {
      label: t('review.notice.review'),
      run: () => go(() => openAdminSection('review')),
    };
  } else if (notice.kind === 'approved') {
    const name = resolveSceneName(notice, locale);
    title = notice.update
      ? t('review.notice.approvedUpdate', {
          name,
          version: String(notice.version),
        })
      : t('review.notice.approved', { name });
    body = (
      <p className="scene-review-notice__line">
        {t(
          notice.update
            ? 'review.notice.approvedUpdateBody'
            : 'review.notice.approvedBody',
        )}
      </p>
    );
    action = {
      label: t('review.notice.openMine'),
      run: () => go(() => openGalleryPage({ kind: 'mine' })),
    };
  } else {
    const name = resolveSceneName(notice, locale);
    title = notice.liveVersion
      ? t('review.notice.rejectedUpdate', {
          name,
          version: String(notice.version),
        })
      : t('review.notice.rejected', { name });
    body = (
      <>
        <span className="scene-review-notice__reason">
          {t(REJECT_REASON_LABELS[notice.reason])}
        </span>
        {notice.reasonNote && (
          <p className="scene-review-notice__quote">{notice.reasonNote}</p>
        )}
        {notice.liveVersion && (
          <p className="scene-review-notice__line">
            {t('review.notice.keepsLive', {
              version: String(notice.liveVersion),
            })}
          </p>
        )}
      </>
    );
    action = {
      label: t('review.notice.openStudio'),
      run: () => go(() => openPlusPlace('studio')),
    };
  }

  return (
    <div
      className={`scene-review-notice scene-review-notice--${notice.kind}`}
      role="dialog"
      aria-labelledby="scene-review-notice-title"
      style={edge}
    >
      <div className="scene-review-notice__body">
        <span className="scene-review-notice__mark" aria-hidden="true">
          <Glyph name={MARKS[notice.kind]} />
        </span>
        <div className="scene-review-notice__text">
          <strong id="scene-review-notice-title">{title}</strong>
          {body}
        </div>
      </div>
      <div className="scene-review-notice__actions">
        <button type="button" className="button small subtle" onClick={putAway}>
          {quiet}
        </button>
        <button type="button" className="button small" onClick={action.run}>
          {action.label}
        </button>
      </div>
    </div>
  );
}
