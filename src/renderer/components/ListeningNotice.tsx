/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import {
  LISTENING_DAY_CAP_MINUTES,
  LISTENING_WINDOW_DAYS,
  type TListeningFailure,
} from 'common/listening';
import MenuIcon from '../icons/MenuIcon';
import { setListeningSharing, useListening } from '../usage/listeningStore';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/ListeningNotice.scss';

export const LISTENING_ERRORS: Record<TListeningFailure, TranslationKey> = {
  offline: 'listening.error.offline',
  'signed-out': 'listening.error.signedOut',
  server: 'listening.error.server',
};

/**
 * Tells a signed-in account, once, that its listening time is counted for
 * FluidEQ's own statistics (premium 0068), and takes its answer.
 *
 * Nothing is counted until it is answered: main drops every report for an
 * account the server has no answer for. So there is no close button — put
 * away unanswered, the notice would leave an account neither counted nor
 * asked — and the answer is written to the server, which holds it for every
 * computer the account signs in on. Keeping it on is the loud button, as the
 * suggested answer; turning it off is the quiet one, and the account panel
 * can change either later.
 *
 * Beside the work, never in front of it: the corner, after the terms notice
 * (`noticeTurn.ts`).
 */
const ListeningNotice = () => {
  const { t } = useTranslation();
  const { status, saving, error } = useListening();
  const wants = status.signedIn && status.choice === 'unasked';
  const isShown = useNoticeTurn('listening', wants);
  if (!isShown) {
    return null;
  }

  return (
    <CompactFrame
      className="listening-notice"
      icon={<MenuIcon name="waveform" />}
      title={t('listening.notice.title')}
      titleId="listening-notice-title"
      role="dialog"
      aria-modal="false"
      aria-describedby="listening-notice-body"
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            disabled={saving}
            onClick={() => {
              setListeningSharing(false).catch(() => undefined);
            }}
          >
            {t('listening.notice.off')}
          </button>
          <button
            type="button"
            className="button small"
            disabled={saving}
            onClick={() => {
              setListeningSharing(true).catch(() => undefined);
            }}
          >
            {t('listening.notice.keep')}
          </button>
        </>
      }
    >
      {/* What is sent, drawn: a fortnight of days, one number each. */}
      <span className="listening-notice__days" aria-hidden="true">
        {Array.from({ length: LISTENING_WINDOW_DAYS }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      <p id="listening-notice-body" className="listening-notice__body">
        {t('listening.notice.body', {
          days: String(LISTENING_WINDOW_DAYS),
          hours: String(LISTENING_DAY_CAP_MINUTES / 60),
        })}
      </p>
      <p className="listening-notice__note">{t('listening.notice.change')}</p>
      {error && (
        <p className="account__error" role="alert">
          {t(LISTENING_ERRORS[error])}
        </p>
      )}
    </CompactFrame>
  );
};

export default ListeningNotice;
