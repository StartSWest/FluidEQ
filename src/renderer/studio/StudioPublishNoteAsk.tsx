/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

interface IStudioPublishNoteAskProps {
  /** An update's line says what changed; a first version's, what it is. */
  update: boolean;
  /** Yes: the scene's chat writes the line. */
  onWrite: () => void;
  /** No: the member writes it, and the box is where the focus goes. */
  onMine: () => void;
}

/**
 * Asked when Send is pressed with no line written (Ivan, 2026-11-23: "if
 * they don't have notes and they click publish ... ask ... you want the AI
 * to write them down? And if they select yes, the agent will start writing
 * them"). The question takes the footer's line over the buttons, and its two
 * answers take the buttons' place, so it is asked exactly where the member
 * just pressed; a second window over the dialog would be a modal on a modal,
 * and the question beside a live Send gave two loud buttons to choose from.
 *
 * Writing with AI is the recommendation, so it wears the loud style and
 * takes the focus: Enter pressed by habit asks the chat. The line it writes
 * lands in the box and Send waits for the member to press it again — the
 * chat never sends a line nobody has read (`usePublishNoteSend`).
 */
export default function StudioPublishNoteAsk({
  update,
  onWrite,
  onMine,
}: IStudioPublishNoteAskProps) {
  const { t } = useTranslation();
  const questionId = useId();
  const writeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    writeRef.current?.focus();
  }, []);
  return (
    <>
      <p
        id={questionId}
        className="studio-publish__held studio-publish__ask"
        role="status"
      >
        <MenuIcon name="smart" className="studio-publish__held-icon" />
        <span>
          {t(update ? 'studio.publish.askNote' : 'studio.publish.askNoteFirst')}
        </span>
      </p>
      <div
        className="dialog-frame__actions"
        role="group"
        aria-labelledby={questionId}
      >
        <button type="button" className="button small subtle" onClick={onMine}>
          {t('studio.publish.askNoteMine')}
        </button>
        <button
          ref={writeRef}
          type="button"
          className="button small"
          onClick={onWrite}
        >
          <MenuIcon name="smart" />
          {t('studio.publish.noteWriteAi')}
        </button>
      </div>
    </>
  );
}
