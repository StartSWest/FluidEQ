/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { noteIn } from 'common/sceneVersionNote';
import { useId, useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useChatPopover from '../studio/chat/useChatPopover';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { REJECT_REASON_LABELS } from './rejectReasons';
import { useSceneReview } from './sceneReviewStore';
import '../styles/SceneReviewMark.scss';

interface ISceneReviewMarkProps {
  /** The maker's own scene id, as its `pack.json` names it. */
  sceneId: string | undefined;
}

/**
 * Where the review stands with one of the maker's scenes, beside its name
 * wherever the maker works on it: the Studio's bar and its project picker.
 *
 * Ivan, 2026-11-11: "make sure it is shown on the Studio somewhere until they
 * republish", "like with a warning icon, they hover and see the reason". A
 * scene the review refused wears a warning that opens the admin's reason in
 * full, the date and what to do next on a hover, on keyboard focus and on a
 * press — the press keeps it open, so the reason can be read at leisure and
 * selected. A scene sent and not yet answered wears a quiet clock instead.
 * Both come from the server's record (`sceneReviewStanding.ts`), so neither
 * goes away by putting the corner notice away, restarting or changing PC —
 * only by sending the scene again, or by the review answering.
 */
export default function SceneReviewMark({ sceneId }: ISceneReviewMarkProps) {
  const { t, locale } = useTranslation();
  const { standings } = useSceneReview();
  const pinned = useChatPopover();
  const [peeking, setPeeking] = useState(false);
  const panelId = useId();
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
  const isOpen = pinned.isOpen || peeking;
  return (
    <>
      <button
        ref={pinned.setAnchor}
        type="button"
        className="scene-review-mark scene-review-mark--rejected"
        aria-label={t('review.mark.show')}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onPointerEnter={() => setPeeking(true)}
        onPointerLeave={() => setPeeking(false)}
        onFocus={() => setPeeking(true)}
        onBlur={() => setPeeking(false)}
        onClick={pinned.toggle}
      >
        <MenuIcon name="alert" />
      </button>
      <AnchoredMenu
        anchor={pinned.anchor}
        isOpen={isOpen}
        role="dialog"
        className="scene-review-mark__panel"
        ariaLabel={t('review.mark.rejected')}
        align="left"
      >
        <div id={panelId} className="scene-review-mark__body">
          <p className="scene-review-mark__title">
            <MenuIcon name="alert" />
            {t('review.mark.rejectedOn', { date })}
          </p>
          <p className="scene-review-mark__reason">
            {t(REJECT_REASON_LABELS[standing.reason])}
          </p>
          {standing.reasonNotes && (
            <p className="scene-review-mark__note">
              {noteIn(standing.reasonNotes, locale)}
            </p>
          )}
          <p className="scene-review-mark__next">{t('review.next')}</p>
        </div>
      </AnchoredMenu>
    </>
  );
}
