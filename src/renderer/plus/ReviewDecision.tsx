/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  REJECT_REASONS,
  type TRejectReason,
  type TReviewAnswer,
} from 'common/plusReview';
import { MAX_VERSION_NOTE } from 'common/sceneVersionNote';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

export const REJECT_REASON_LABELS: Record<TRejectReason, TranslationKey> = {
  flashing: 'review.reason.flashing',
  rights: 'review.reason.rights',
  offensive: 'review.reason.offensive',
  broken: 'review.reason.broken',
  other: 'review.reason.other',
};

interface IReviewDecisionProps {
  /** Which answer is being sent, if any. */
  working?: TReviewAnswer['action'];
  /**
   * Whether the admin has seen the scene play: it arrived, verified, and drew
   * on this screen with nothing wrong. Approving waits for it — nothing goes
   * to every member unseen. Refusing does not: a scene that will not open or
   * will not run is exactly one to refuse, as broken.
   */
  watched: boolean;
  onAnswer: (answer: TReviewAnswer) => void;
}

/**
 * The admin's answer to a scene waiting for review.
 *
 * Approving is the recommendation and wears the loud style — most scenes are
 * fine, and a maker is waiting on each one. Not approving asks why, from a
 * fixed list the maker is told in their own language, with room for one line
 * of the admin's own: a refusal with no reason teaches a maker nothing.
 */
export default function ReviewDecision({
  working,
  watched,
  onAnswer,
}: IReviewDecisionProps) {
  const { t } = useTranslation();
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState<TRejectReason>();
  const [note, setNote] = useState('');
  const titleId = useId();
  const noteId = useId();
  const busy = working !== undefined;

  if (!refusing) {
    // Stacked across the side column, the way a gallery scene's page puts
    // its own main action: the recommendation first and full width, the
    // other under it. Side by side they wrapped into a ragged pair.
    return (
      <div className="review-decision review-decision--main">
        <button
          type="button"
          className={`button small${working === 'approve' ? ' is-running' : ''}`}
          aria-busy={working === 'approve'}
          disabled={!watched || (busy && working !== 'approve')}
          onClick={() => {
            if (!busy) {
              onAnswer({ action: 'approve' });
            }
          }}
        >
          <Glyph name="check" />
          {working === 'approve' ? t('review.approving') : t('review.approve')}
        </button>
        <button
          type="button"
          className="button small subtle"
          disabled={busy}
          onClick={() => setRefusing(true)}
        >
          {t('review.reject')}
        </button>
      </div>
    );
  }

  const trimmed = note.trim();
  return (
    <section className="review-refusal" aria-labelledby={titleId}>
      <h4 id={titleId} className="review-refusal__title">
        {t('review.reject.title')}
      </h4>
      <p className="gallery-fine">{t('review.reject.lead')}</p>
      <div
        className="gallery-reasons"
        role="radiogroup"
        aria-labelledby={titleId}
      >
        {REJECT_REASONS.map((entry) => (
          <label
            key={entry}
            className="gallery-reason"
            htmlFor={`${titleId}-${entry}`}
          >
            <input
              id={`${titleId}-${entry}`}
              type="radio"
              name={`review-reason-${titleId}`}
              value={entry}
              checked={reason === entry}
              disabled={busy}
              onChange={() => setReason(entry)}
            />
            <span>{t(REJECT_REASON_LABELS[entry])}</span>
          </label>
        ))}
      </div>
      <label className="gallery-dialog__label" htmlFor={noteId}>
        {t('review.reject.noteLabel')}
      </label>
      <textarea
        id={noteId}
        className="review-refusal__note"
        rows={2}
        maxLength={MAX_VERSION_NOTE}
        value={note}
        disabled={busy}
        placeholder={t('review.reject.notePlaceholder')}
        onChange={(event) =>
          // One line, as the maker's notice has room for and the server keeps.
          setNote(event.target.value.replace(/\s*\n\s*/g, ' '))
        }
      />
      <div className="review-decision">
        <button
          type="button"
          className="button small subtle"
          disabled={busy}
          onClick={() => setRefusing(false)}
        >
          {t('review.reject.cancel')}
        </button>
        <button
          type="button"
          className={`button small${working === 'reject' ? ' is-running' : ''}`}
          aria-busy={working === 'reject'}
          disabled={!reason || (busy && working !== 'reject')}
          onClick={() => {
            if (reason && !busy) {
              onAnswer({
                action: 'reject',
                reason,
                ...(trimmed ? { note: trimmed } : {}),
              });
            }
          }}
        >
          {working === 'reject'
            ? t('review.reject.sending')
            : t('review.reject.send')}
        </button>
      </div>
    </section>
  );
}
