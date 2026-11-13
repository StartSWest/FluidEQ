/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { noteIn } from 'common/sceneVersionNote';
import type { ISceneSubmission } from 'common/plusReview';
import { resolveSceneName } from 'common/scenePacks';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { categoriesLabel } from './GalleryParts';
import { REJECT_REASON_LABELS } from './rejectReasons';
import ReviewPicture from './ReviewPicture';
import { useSceneReview } from './sceneReviewStore';

interface IReviewStateProps {
  submission: ISceneSubmission;
  /** The version members have now, for a submission that would replace it. */
  liveVersion?: number;
}

/**
 * What became of a scene sent for review, said the same way wherever the
 * scene is listed: waiting, or not approved and why. Approved says nothing —
 * it is simply the version in the gallery.
 */
export function ReviewState({ submission, liveVersion }: IReviewStateProps) {
  const { t, locale } = useTranslation();
  const { standings } = useSceneReview();
  // What to do next only while this refusal is still the newest word on the
  // scene: one already sent again, or approved since, has nothing to fix.
  const standing = standings?.[submission.sceneId];
  const stillRefused =
    standing?.kind === 'rejected' && standing.version === submission.version;
  const update = liveVersion !== undefined;
  const version = String(submission.version);
  if (submission.state === 'pending') {
    return (
      <span className="review-row__facts">
        <span className="review-kind review-kind--update">
          {update
            ? t('review.state.pendingUpdate', { version })
            : t('review.state.pending')}
        </span>
      </span>
    );
  }
  if (submission.state !== 'rejected' || !submission.reason) {
    return null;
  }
  return (
    <>
      <span className="review-row__facts">
        <span className="review-kind review-kind--refused">
          {/* The Studio's warning for the same refusal (`SceneReviewMark`). */}
          <MenuIcon name="alert" className="menu-icon review-kind__mark" />
          {update
            ? t('review.state.rejectedUpdate', { version })
            : t('review.state.rejected')}
        </span>
        <span className="review-row__when">
          {t(REJECT_REASON_LABELS[submission.reason])}
        </span>
      </span>
      {submission.reasonNotes && (
        <span className="review-row__note review-row__note--whole">
          {noteIn(submission.reasonNotes, locale)}
        </span>
      )}
      {stillRefused && (
        <span className="review-row__next">{t('review.next')}</span>
      )}
    </>
  );
}

interface ISubmittedSceneRowProps {
  submission: ISceneSubmission;
  me: string;
  busy: boolean;
  confirming: boolean;
  onConfirm: (confirming: boolean) => void;
  onWithdraw: () => void;
}

/**
 * A scene its maker sent for review that is not in the gallery yet: waiting,
 * or not approved. Withdrawing takes it back — the same press that takes a
 * published scene down, asked about first the same way.
 */
export default function SubmittedSceneRow({
  submission,
  me,
  busy,
  confirming,
  onConfirm,
  onWithdraw,
}: ISubmittedSceneRowProps) {
  const { t, locale } = useTranslation();
  const name = resolveSceneName(submission, locale);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const waiting = submission.state === 'pending';

  return (
    <li
      className={`gallery-row review-row${confirming ? ' is-confirming' : ''}`}
    >
      <ReviewPicture
        className="gallery-row__picture"
        authorId={me}
        sceneId={submission.sceneId}
        // Only what still waits has its files; an answered one is tidied.
        sha256={waiting ? submission.sha256 : undefined}
      />
      <span className="gallery-row__text">
        <span className="gallery-row__name">{name}</span>
        <span className="gallery-row__meta">
          {categoriesLabel(t, submission)} ·{' '}
          {t('plus.mine.version', { version: String(submission.version) })} ·{' '}
          {t('review.sent', {
            date: dates.format(new Date(submission.submittedAt)),
          })}
        </span>
        <ReviewState submission={submission} />
      </span>
      <span className="gallery-row__actions">
        {confirming ? (
          <>
            <span className="gallery-row__confirm">
              {t(waiting ? 'review.withdrawConfirm' : 'review.removeConfirm')}
            </span>
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={() => onConfirm(false)}
            >
              {t('plus.mine.confirmNo')}
            </button>
            <button
              type="button"
              className={`button small danger${busy ? ' is-running' : ''}`}
              aria-busy={busy}
              onClick={() => {
                if (!busy) {
                  onWithdraw();
                }
              }}
            >
              {t(waiting ? 'review.withdraw' : 'review.remove')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button small subtle"
            onClick={() => onConfirm(true)}
          >
            {t(waiting ? 'review.withdraw' : 'review.remove')}
          </button>
        )}
      </span>
    </li>
  );
}
