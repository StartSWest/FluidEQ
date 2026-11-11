/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { REJECT_REASON_LABELS } from './rejectReasons';
import { useSceneReview } from './sceneReviewStore';
import '../styles/SceneReviewMark.scss';

interface ISceneReviewBadgeProps {
  sceneId: string | undefined;
}

/**
 * `SceneReviewMark` for a place that is itself a button — a row of the
 * Studio's project picker — where a second control inside would be a button
 * in a button. The same mark, still: the reason, the date and what to do next
 * are its name and its tooltip, read on a hover and by a screen reader with
 * the row; the open project's mark in the bar beside Publish is the one that
 * opens to be read and selected.
 */
export default function SceneReviewBadge({ sceneId }: ISceneReviewBadgeProps) {
  const { t, locale } = useTranslation();
  const { standings } = useSceneReview();
  const standing = sceneId ? standings?.[sceneId] : undefined;
  if (!standing) {
    return null;
  }
  if (standing.kind === 'pending') {
    const label = t('review.mark.pending');
    return (
      <span
        className="scene-review-mark scene-review-mark--pending"
        role="img"
        aria-label={label}
        title={label}
      >
        <MenuIcon name="pending" />
      </span>
    );
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(standing.decidedAt),
  );
  const said = [
    t('review.mark.rejectedOn', { date }),
    t(REJECT_REASON_LABELS[standing.reason]),
    ...(standing.reasonNote ? [standing.reasonNote] : []),
    t('review.next'),
  ].join('\n');
  return (
    <span
      className="scene-review-mark scene-review-mark--rejected scene-review-mark--still"
      role="img"
      aria-label={said}
      title={said}
    >
      <MenuIcon name="alert" />
    </span>
  );
}
