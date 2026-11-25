/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { noteIn } from 'common/sceneVersionNote';
import type { TSceneStanding } from 'common/sceneReviewStanding';
import { useId, useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useChatPopover from '../studio/chat/useChatPopover';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { REJECT_REASON_LABELS } from './rejectReasons';
import '../styles/SceneReviewMark.scss';

type TRefusal = Extract<TSceneStanding, { kind: 'rejected' }>;

interface ISceneReviewWhyProps {
  refusal: TRefusal;
}

/**
 * "See why" after the Studio's sentence that a version was not approved,
 * and the review's reason behind it (Ivan, 2026-11-11: "they hover and see
 * the reason"): the admin's reason in full, the date and what to do next, on
 * a hover, on keyboard focus and on a press — the press keeps it open, so the
 * reason can be read at leisure and selected. It stays until the scene is
 * sent again, because the refusal comes from the server's record
 * (`sceneReviewStanding.ts`), not from anything put away on this computer.
 *
 * It was a warning icon beside the version chip, whose words were only in its
 * hover; the sentence it now follows says what happened, and this is the
 * step after it (Ivan, 2026-11-25, design C).
 */
export default function SceneReviewWhy({ refusal }: ISceneReviewWhyProps) {
  const { t, locale } = useTranslation();
  const pinned = useChatPopover();
  const [peeking, setPeeking] = useState(false);
  const panelId = useId();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(refusal.decidedAt),
  );
  const isOpen = pinned.isOpen || peeking;
  return (
    <>
      <button
        ref={pinned.setAnchor}
        type="button"
        className="link-button studio-line__why"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onPointerEnter={() => setPeeking(true)}
        onPointerLeave={() => setPeeking(false)}
        onFocus={() => setPeeking(true)}
        onBlur={() => setPeeking(false)}
        onClick={pinned.toggle}
      >
        {t('studio.line.seeWhy')}
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
            {t(REJECT_REASON_LABELS[refusal.reason])}
          </p>
          {refusal.reasonNotes && (
            <p className="scene-review-mark__note">
              {noteIn(refusal.reasonNotes, locale)}
            </p>
          )}
          <p className="scene-review-mark__next">{t('review.next')}</p>
        </div>
      </AnchoredMenu>
    </>
  );
}
