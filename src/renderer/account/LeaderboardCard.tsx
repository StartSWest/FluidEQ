import { useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import { PART_POINTS } from 'common/leaderboardScore';
import type { TLeaderboardFailure } from 'main/usage/leaderboardApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import {
  refreshLeaderboardStatus,
  removeMeFromLeaderboard,
  setLeaderboardOptIn,
  useLeaderboard,
} from '../usage/leaderboardStore';
import '../styles/LeaderboardCard.scss';

const ERROR_KEYS: Record<TLeaderboardFailure, TranslationKey> = {
  plus_required: 'leaderboard.error.plusRequired',
  signed_out: 'leaderboard.error.signedOut',
  network: 'leaderboard.error.network',
  rejected: 'leaderboard.error.rejected',
};

/** The most a day can count for, in minutes; the ring is full at this. */
const DAY_CAP_MINUTES = 16 * 60;
const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The one place this app ever offers to send anything about you.
 *
 * Off by default, and the card says exactly what leaves the machine before it
 * offers the switch: one number a day, whole minutes of music that played,
 * capped at sixteen hours, with the date, the version and the language. Not
 * what played, not from where. Joining is the loud action while you are out;
 * leaving is the quiet one while you are in; removing everything is quieter
 * still, and always available.
 *
 * Today's tally is drawn as a ring filling toward the sixteen-hour cap, so
 * the number the card is about is also the picture on it.
 */
export default function LeaderboardCard() {
  const { t, locale } = useTranslation();
  const { status, error, removed } = useLeaderboard();
  // "Remove all my data" asks once before it does anything: the rank and
  // every day ever sent go with it, and nothing brings them back.
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => {
    refreshLeaderboardStatus().catch(() => undefined);
  }, []);

  const hours = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const filled = Math.min(1, status.todayMinutes / DAY_CAP_MINUTES);

  return (
    <section
      className={`leaderboard-card${status.optedIn ? ' is-joined' : ''}`}
      aria-labelledby="leaderboard-card-title"
    >
      <div className="leaderboard-card__head">
        <span className="leaderboard-card__mark" aria-hidden="true">
          <Glyph name="board" />
        </span>
        <span id="leaderboard-card-title" className="plus-card__eyebrow">
          {t('leaderboard.card.title')}
        </span>
        {status.optedIn && (
          <span className="plus-card__badge">{t('account.plus.active')}</span>
        )}
      </div>

      <div className="leaderboard-card__tally">
        <svg
          className="leaderboard-card__ring"
          viewBox="0 0 64 64"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            className="leaderboard-card__ring-track"
            cx="32"
            cy="32"
            r={RING_RADIUS}
          />
          <circle
            className="leaderboard-card__ring-fill"
            cx="32"
            cy="32"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - filled)}
          />
        </svg>
        <p className="leaderboard-card__today">
          {t('leaderboard.card.today', {
            hours: hours.format(status.todayMinutes / 60),
          })}
        </p>
      </div>

      <p className="leaderboard-card__body">{t('leaderboard.card.body')}</p>
      {/* The numbers come from the scoring itself, so the sentence cannot
          drift from the board it explains in any of the ten languages. */}
      <p className="leaderboard-card__note">
        {t('leaderboard.scoring', { ...PART_POINTS })}
      </p>
      {status.optedIn && !status.eligible && (
        <p className="leaderboard-card__note">
          {t('leaderboard.card.plusOnly')}
        </p>
      )}
      {error && (
        <p className="account__error" role="alert">
          {t(ERROR_KEYS[error])}
        </p>
      )}
      {removed && (
        <p className="leaderboard-card__note" role="status">
          {t('leaderboard.card.removed')}
        </p>
      )}

      {confirmingRemoval ? (
        // The question replaces the buttons rather than floating over them:
        // the loud button is keeping the data, the quiet red one is the one
        // that cannot be undone.
        <div className="leaderboard-card__confirm" role="alertdialog">
          <span className="leaderboard-card__confirm-title">
            {t('leaderboard.card.removeConfirmTitle')}
          </span>
          <span className="leaderboard-card__confirm-body">
            {t('leaderboard.card.removeConfirmBody')}
          </span>
          <div className="account__actions">
            <button
              type="button"
              className="button small"
              onClick={() => setConfirmingRemoval(false)}
            >
              {t('leaderboard.card.removeKeep')}
            </button>
            <button
              type="button"
              className="button small subtle leaderboard-card__danger"
              onClick={() => {
                setConfirmingRemoval(false);
                removeMeFromLeaderboard().catch(() => undefined);
              }}
            >
              {t('leaderboard.card.removeConfirm')}
            </button>
          </div>
        </div>
      ) : (
        <div className="account__actions">
          {status.optedIn ? (
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                setLeaderboardOptIn(false).catch(() => undefined);
              }}
            >
              {t('leaderboard.card.leave')}
            </button>
          ) : (
            <button
              type="button"
              className="button small"
              onClick={() => {
                setLeaderboardOptIn(true).catch(() => undefined);
              }}
            >
              {t('leaderboard.card.join')}
            </button>
          )}
          <button
            type="button"
            className="button small subtle"
            onClick={() => setConfirmingRemoval(true)}
          >
            {t('leaderboard.card.remove')}
          </button>
        </div>
      )}
    </section>
  );
}
