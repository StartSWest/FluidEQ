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
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/I18nContext';
import '../styles/Button.scss';
import '../styles/RestartAudioDialog.scss';

export interface IRestartAudioDialogProps {
  /** Resolves to an empty string on success, or the reason it did not work. */
  onRestart: () => Promise<string>;
  onClose: () => void;
}

type TPhase = 'ask' | 'running' | 'done' | 'failed';

const RestartAudioDialog = ({
  onRestart,
  onClose,
}: IRestartAudioDialogProps) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<TPhase>('ask');
  const [reason, setReason] = useState('');
  const surfaceRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isRunning = phase === 'running';

  useEffect(() => {
    const previousFocus = document.activeElement;
    return () => {
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Not while Windows is mid-restart: there is nothing to cancel, and a
        // card that vanishes then leaves the outcome with nowhere to land.
        if (!isRunning) {
          event.preventDefault();
          onClose();
        }
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
      if (!buttons.length) {
        return;
      }
      event.preventDefault();
      const current = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      buttons[
        (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isRunning, onClose]);

  const handleRestart = async () => {
    if (isRunning) {
      return;
    }
    setPhase('running');
    setReason('');
    const error = await onRestart();
    setReason(error);
    setPhase(error ? 'failed' : 'done');
  };

  const body = {
    ask: t('notice.restartConfirm'),
    running: t('notice.restartConfirm'),
    done: t('notice.restartDone'),
    failed: t('restart.failed'),
  }[phase];

  return createPortal(
    <div
      className="restart-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isRunning) {
          onClose();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="restart-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="restart-dialog-title"
        aria-describedby="restart-dialog-body"
        aria-busy={isRunning}
      >
        <div className="restart-dialog__head">
          <span className="restart-dialog__glyph" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M16.2 8.6A6.5 6.5 0 0 0 4.4 6.3M3.8 11.4a6.5 6.5 0 0 0 11.8 2.3" />
              <path d="M16.5 4.2v4.4h-4.4M3.5 15.8v-4.4h4.4" />
            </svg>
          </span>
          <h2 id="restart-dialog-title" className="restart-dialog__title">
            {t('restart.title')}
          </h2>
        </div>
        <p
          id="restart-dialog-body"
          className={`restart-dialog__body${
            phase === 'failed' ? ' restart-dialog__body--failed' : ''
          }`}
        >
          {body}
          {phase === 'failed' && reason && (
            <span className="restart-dialog__reason">{reason}</span>
          )}
        </p>
        <div className="restart-dialog__foot">
          <p className="restart-dialog__status" aria-live="polite">
            {isRunning ? t('restart.running') : ''}
          </p>
          <div className="restart-dialog__actions">
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
                <button
                  type="button"
                  className="button small subtle"
                  disabled={isRunning}
                  onClick={onClose}
                >
                  {t('config.cancel')}
                </button>
                {/* Not disabled while it works — `is-running` is how this app
                    shows a button doing something — so it stays where a
                    finger is, and the guard above refuses a second press. */}
                <button
                  ref={primaryRef}
                  type="button"
                  className={`button small${isRunning ? ' is-running' : ''}`}
                  aria-busy={isRunning}
                  onClick={handleRestart}
                >
                  {phase === 'failed'
                    ? t('restart.tryAgain')
                    : t('restart.action')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RestartAudioDialog;
