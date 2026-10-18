/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import {
  MAX_TRIAL_EXIT_NOTE,
  TRIAL_EXIT_REASONS,
  type TTrialExitReason,
} from 'common/trialExit';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import '../styles/Gallery.scss';

/** Each reason as the member says it, in the first person. */
export const TRIAL_EXIT_REASON_KEYS: Record<TTrialExitReason, TranslationKey> =
  {
    price: 'trialExit.reason.price',
    'not-enough': 'trialExit.reason.not-enough',
    'free-is-enough': 'trialExit.reason.free-is-enough',
    'no-time': 'trialExit.reason.no-time',
    problems: 'trialExit.reason.problems',
    payment: 'trialExit.reason.payment',
    other: 'trialExit.reason.other',
  };

const bridge = () => window.electron?.ipcRenderer;

interface ITrialExitDialogProps {
  /** `true` once the answer is with the server. */
  onClose: (sent: boolean) => void;
}

/**
 * Why a member whose free trial ended did not take Plus: one choice and, if
 * they like, a line of their own. The choices are the report dialog's rows,
 * so it reads as the app's own question rather than a survey dropped in.
 * Only the maker of FluidEQ reads the answers, and the dialog says so.
 */
export default function TrialExitDialog({ onClose }: ITrialExitDialogProps) {
  const { t } = useTranslation();
  const ids = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<TTrialExitReason>();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancel = useCallback(() => onClose(false), [onClose]);
  useModalKeys(surfaceRef, firstRef, { busy: sending, onCancel: cancel });

  const send = () => {
    if (!reason || sending) {
      return;
    }
    const answer = bridge()?.reportTrialExit?.(
      reason,
      note.trim() || undefined,
    );
    if (!answer) {
      setFailed(true);
      return;
    }
    setSending(true);
    setFailed(false);
    answer
      .then((outcome) => {
        setSending(false);
        if (outcome.ok) {
          onClose(true);
        } else {
          setFailed(true);
        }
        return undefined;
      })
      .catch(() => {
        setSending(false);
        setFailed(true);
      });
  };

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !sending) {
          cancel();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="gallery-report-dialog trial-exit-dialog"
        icon={<MenuIcon name="plusTab" />}
        title={t('trialExit.title')}
        titleId={`${ids}-title`}
        description={<span id={`${ids}-lead`}>{t('trialExit.lead')}</span>}
        aria-describedby={`${ids}-lead`}
        aria-busy={sending}
        closeLabel={t('support.close')}
        onClose={sending ? undefined : cancel}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={sending}
              onClick={cancel}
            >
              {t('trialExit.later')}
            </button>
            <button
              type="button"
              className={`button small${sending ? ' is-running' : ''}`}
              aria-busy={sending}
              disabled={!reason}
              onClick={send}
            >
              {sending ? t('trialExit.sending') : t('trialExit.send')}
            </button>
          </div>
        }
      >
        <div
          className="dialog-frame__group gallery-report-dialog__reasons"
          role="radiogroup"
          aria-labelledby={`${ids}-title`}
        >
          {TRIAL_EXIT_REASONS.map((entry, index) => (
            <label
              key={entry}
              className="gallery-report-dialog__reason"
              htmlFor={`${ids}-${entry}`}
            >
              <input
                ref={index === 0 ? firstRef : undefined}
                id={`${ids}-${entry}`}
                type="radio"
                name={`${ids}-reason`}
                value={entry}
                checked={reason === entry}
                disabled={sending}
                onChange={() => setReason(entry)}
              />
              <span
                className="gallery-report-dialog__radio"
                aria-hidden="true"
              />
              <span>{t(TRIAL_EXIT_REASON_KEYS[entry])}</span>
            </label>
          ))}
        </div>
        <label className="trial-exit-dialog__note" htmlFor={`${ids}-note`}>
          <span className="gallery-dialog__label">{t('trialExit.note')}</span>
          <textarea
            id={`${ids}-note`}
            rows={3}
            maxLength={MAX_TRIAL_EXIT_NOTE}
            value={note}
            disabled={sending}
            placeholder={t('trialExit.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {failed && (
          <p className="gallery-dialog__error" role="alert">
            {t('trialExit.failed')}
          </p>
        )}
      </DialogFrame>
    </div>,
    document.body,
  );
}
