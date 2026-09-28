/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * "Restart Windows audio", asked and answered inside the app.
 *
 * It was a native message box: a grey Windows panel titled with the product
 * name, floating over a dark window it shared nothing with, followed by a
 * second one to say it was done. The engine dialog beside it is drawn by the
 * app, so the one question that follows it most often now is too — same
 * surface, same buttons, and the outcome shown in the same card rather than
 * in another box.
 *
 * Four states, one card: the question, the restart in progress (the button
 * breathes and the foot says so — a click that shows nothing for the seconds
 * Windows takes reads as a dead button), done, and failed with the reason.
 * The restart itself belongs to `useAudioRestart`, so the card can be closed
 * while Windows works and the restart carries on without it.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import type { TRestartPhase } from '../utils/useAudioRestart';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import holdFocusReturn from '../utils/focusReturn';
import '../styles/Button.scss';
import '../styles/RestartAudioDialog.scss';

export interface IRestartAudioDialogProps {
  phase: TRestartPhase;
  outcome?: IAudioRestartOutcome;
  onRestart: () => void;
  onClose: () => void;
}

const RestartAudioDialog = ({
  phase,
  outcome,
  onRestart,
  onClose,
}: IRestartAudioDialogProps) => {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isRunning = phase === 'running';

  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    // Opened again while Windows is still restarting, the one thing to press
    // is Close; Restart is breathing and refuses a second go.
    if (phase === 'running') {
      closeRef.current?.focus();
    }
    return giveFocusBack;
    // Once, on mount: the phase effect below takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The recommended answer is where a keyboard lands: Enter restarts, and
  // once it is done Enter closes. Re-run on the phase because "done" swaps
  // the pair of buttons for one OK, and focus would otherwise fall to the
  // page behind the card.
  useEffect(() => {
    if (!isRunning) {
      primaryRef.current?.focus();
    }
  }, [isRunning]);

  useEffect(() => {
    // In the capture phase and stopped there. The troubleshooter this card
    // opens over listens on the document too, subscribed earlier, so it
    // heard every Escape first: one press closed both, and mid-restart it
    // threw away the troubleshooter's record of what had been tried. The
    // graph's full-screen Escape, on the window, is kept out the same way.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const buttons = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)',
        ) ?? [],
      );
      event.preventDefault();
      event.stopPropagation();
      if (!buttons.length) {
        return;
      }
      const current = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      buttons[
        (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const failedLine =
    outcome?.declined === true ? t('restart.declined') : t('restart.failed');
  const body = {
    ask: t('notice.restartConfirm'),
    running: t('notice.restartConfirm'),
    done: t('notice.restartDone'),
    failed: failedLine,
  }[phase];

  return createPortal(
    <div
      className="restart-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <CompactFrame
        ref={surfaceRef}
        className="restart-audio"
        // The restart arrows, the mark the notice bar's "restart now" wears,
        // so the card reads as that action's own window; amber once Windows
        // has refused, before a word of the reason is read.
        icon={<MenuIcon name="restart" />}
        tone={phase === 'failed' ? 'warn' : 'accent'}
        title={t('restart.title')}
        titleId="restart-dialog-title"
        aria-describedby="restart-dialog-body"
        aria-busy={isRunning}
        onClose={onClose}
        closeLabel={t('restart.close')}
        actions={
          <>
            {/* Kept in the row even when empty, so the buttons do not move
                the moment the restart starts. */}
            <p className="restart-audio__status" aria-live="polite">
              {isRunning ? t('restart.running') : ''}
            </p>
            {phase === 'done' ? (
              <button
                ref={primaryRef}
                type="button"
                className="button small"
                onClick={onClose}
              >
                {t('whatsNew.ok')}
              </button>
            ) : (
              <>
                {/* Enabled while Windows works: closing sends the restart
                    to the background rather than cancelling it, which is
                    not something a service restart half done can do. */}
                <button
                  ref={closeRef}
                  type="button"
                  className="button small subtle"
                  onClick={onClose}
                >
                  {isRunning ? t('restart.close') : t('config.cancel')}
                </button>
                {/* Not disabled while it works — `is-running` is how this app
                    shows a button doing something — so it stays where a
                    finger is, and the restart's owner refuses a second go. */}
                <button
                  ref={primaryRef}
                  type="button"
                  className={`button small${isRunning ? ' is-running' : ''}`}
                  aria-busy={isRunning}
                  onClick={onRestart}
                >
                  {phase === 'failed'
                    ? t('restart.tryAgain')
                    : t('restart.action')}
                </button>
              </>
            )}
          </>
        }
      >
        <p
          id="restart-dialog-body"
          className={phase === 'failed' ? 'restart-audio__failure' : undefined}
        >
          {body}
          {phase === 'failed' && outcome?.detail && (
            <span className="restart-audio__reason">{outcome.detail}</span>
          )}
        </p>
      </CompactFrame>
    </div>,
    document.body,
  );
};

export default RestartAudioDialog;
