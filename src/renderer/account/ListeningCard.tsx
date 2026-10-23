/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import {
  LISTENING_DAY_CAP_MINUTES,
  LISTENING_WINDOW_DAYS,
} from 'common/listening';
import { LISTENING_ERRORS } from '../components/ListeningNotice';
import { formatDuration } from '../plus/insightsFormat';
import { setListeningSharing, useListening } from '../usage/listeningStore';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import '../styles/ListeningCard.scss';

/** "0 min" before the first minute, not the seconds a duration would say. */
const todayText = (
  minutes: number,
  locale: Parameters<typeof formatDuration>[1],
  t: Parameters<typeof formatDuration>[2],
) =>
  minutes > 0
    ? formatDuration(minutes * 60, locale, t)
    : new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'minute',
        unitDisplay: 'short',
      }).format(0);

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Whether this account's listening time is counted for FluidEQ's statistics
 * (premium 0068), in the account panel: the switch, today's count on this
 * computer, and what FluidEQ sees, folded away.
 *
 * Today's count is a ring filling toward the sixteen-hour cap, so the number
 * the card is about is also its picture. Off, the ring is empty and says so
 * in words: the server deleted every day this account sent, and nothing more
 * is counted. Before the server has answered (`unknown`) the switch is held,
 * because flipping it then would be answering for an account that may
 * already have answered on another computer.
 */
export default function ListeningCard() {
  const { t, locale } = useTranslation();
  const id = useId();
  const { status, saving, error } = useListening();
  if (!status.signedIn) {
    return null;
  }
  const on = status.choice === 'sharing';
  const filled = on
    ? Math.min(1, status.todayMinutes / LISTENING_DAY_CAP_MINUTES)
    : 0;

  return (
    <section
      className={`listening-card${on ? ' is-on' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="listening-card__head">
        <span id={`${id}-title`} className="plus-card__eyebrow">
          {t('listening.card.title')}
        </span>
      </div>

      <div className="listening-card__row">
        <svg
          className="listening-card__ring"
          viewBox="0 0 64 64"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            className="listening-card__ring-track"
            cx="32"
            cy="32"
            r={RING_RADIUS}
          />
          <circle
            className="listening-card__ring-fill"
            cx="32"
            cy="32"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - filled)}
          />
        </svg>
        <span className="listening-card__tally">
          <span className="listening-card__label">
            {t('listening.card.today')}
          </span>
          <span className="listening-card__value">
            {on
              ? todayText(status.todayMinutes, locale, t)
              : t('listening.card.notCounted')}
          </span>
        </span>
        <span className="listening-card__switch">
          <label
            htmlFor={`${id}-switch`}
            className="listening-card__switch-label"
          >
            {t('listening.card.switch')}
          </label>
          <Switch
            id={`${id}-switch`}
            isOn={on}
            isDisabled={saving || status.choice === 'unknown'}
            handleToggle={() => {
              setListeningSharing(!on).catch(() => undefined);
            }}
            ariaLabel={t('listening.card.switch')}
          />
        </span>
      </div>

      {status.choice === 'off' && (
        <p className="listening-card__note">{t('listening.card.offNote')}</p>
      )}
      {status.choice === 'unknown' && (
        <p className="listening-card__note">
          {t('listening.card.unknownNote')}
        </p>
      )}
      {error && (
        <p className="account__error" role="alert">
          {t(LISTENING_ERRORS[error])}
        </p>
      )}

      <details className="listening-card__what">
        <summary>{t('listening.card.what')}</summary>
        <p className="listening-card__body">
          {t('listening.notice.body', {
            days: String(LISTENING_WINDOW_DAYS),
            hours: String(LISTENING_DAY_CAP_MINUTES / 60),
          })}
        </p>
      </details>
    </section>
  );
}
