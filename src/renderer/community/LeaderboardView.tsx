import { useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import type {
  ILeaderboardRow,
  TLeaderboardFailure,
  TLeaderboardPeriod,
} from 'main/usage/leaderboardApi';
import { requestAccountPanel } from '../account/accountPanel';
import { useTranslation } from '../utils/I18nContext';
import { loadLeaderboard, useLeaderboard } from '../usage/leaderboardStore';
import Avatar from './Avatar';
import Glyph from './Glyph';
import LeaderboardStats from './LeaderboardStats';
import { identityStyle } from './identity';

const ERROR_KEYS: Record<TLeaderboardFailure, TranslationKey> = {
  plus_required: 'leaderboard.error.plusRequired',
  signed_out: 'leaderboard.error.signedOut',
  network: 'leaderboard.error.network',
  rejected: 'leaderboard.error.rejected',
};

const PERIODS: readonly TLeaderboardPeriod[] = ['all', 'month'];
/** How many rows stand on the podium; the list starts after them. */
const PODIUM = 3;
/** Skeleton rows while the first answer is on its way. */
const SKELETON_ROWS = 6;

/**
 * Who is here most.
 *
 * Ranked by points the server scores — hours listened, days shown up, messages
 * posted, replies from the maker, mentions from others — with the parts under
 * every name so a place can be read as a reason, not just a number. The top
 * three stand on a podium, first in the middle and a step higher, the way
 * every podium is read; everyone else is a row with a bar against the leader.
 * Your own place is pinned at the bottom whenever it is not already on screen.
 */
export default function LeaderboardView() {
  const { t, locale } = useTranslation();
  const { board, loading, error, status } = useLeaderboard();
  const [period, setPeriod] = useState<TLeaderboardPeriod>('all');

  useEffect(() => {
    loadLeaderboard(period).catch(() => undefined);
  }, [period]);

  const numbers = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const hoursOf = (minutes: number) => numbers.format(minutes / 60);
  const pointsOf = (points: number) =>
    t('leaderboard.points', { points: numbers.format(points) });

  const rows = board?.period === period ? board.rows : [];
  const me = board?.period === period ? board.me : undefined;
  const meInTop = me !== undefined && rows.some((row) => row.rank === me.rank);
  const leader = rows[0]?.points ?? 0;
  const share = (points: number) =>
    leader > 0 ? Math.max(0.04, points / leader) : 0;

  const podium = rows.slice(0, PODIUM);
  const rest = rows.slice(PODIUM);
  const isMe = (row: ILeaderboardRow) =>
    me !== undefined && row.rank === me.rank && row.points === me.points;

  const roleTag = (row: ILeaderboardRow) => {
    if (row.role === 'admin') {
      return (
        <span className="community__role community__role--admin">
          {t('community.role.admin')}
        </span>
      );
    }
    if (row.role === 'contributor') {
      return (
        <span className="community__role">
          {t('community.role.contributor')}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="leaderboard">
      <header className="leaderboard__head">
        <div className="segmented leaderboard__periods" role="tablist">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={period === option}
              className={`segmented__option${period === option ? ' is-selected' : ''}`}
              onClick={() => setPeriod(option)}
            >
              {option === 'all'
                ? t('leaderboard.allTime')
                : t('leaderboard.thisMonth')}
            </button>
          ))}
        </div>
        {me && (
          <span className="leaderboard__players">
            {t('leaderboard.players', { count: me.players })}
          </span>
        )}
      </header>

      {error && (
        <p className="community__error" role="alert">
          {t(ERROR_KEYS[error])}
        </p>
      )}

      {podium.length > 0 && (
        <ol className="leaderboard__podium">
          {podium.map((row) => (
            <li
              key={`${row.rank}-${row.handle}`}
              className={`leaderboard__place leaderboard__place--${row.rank}${isMe(row) ? ' is-me' : ''}`}
              style={identityStyle(row.handle)}
            >
              <span className="leaderboard__place-rank">{row.rank}</span>
              <Avatar
                handle={row.handle}
                displayName={row.displayName}
                size="podium"
              />
              <span className="leaderboard__place-name community__name community__name--hued">
                {row.displayName || row.handle}
              </span>
              <span className="community__handle">@{row.handle}</span>
              {roleTag(row)}
              {isMe(row) && (
                <span className="leaderboard__place-you">
                  {t('leaderboard.you')}
                </span>
              )}
              <span className="leaderboard__place-points">
                {pointsOf(row.points)}
              </span>
              <LeaderboardStats score={row} hours={hoursOf(row.minutes)} />
              <span className="leaderboard__pedestal" aria-hidden="true" />
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <ol className="leaderboard__rows">
          {rest.map((row) => (
            <li
              key={`${row.rank}-${row.handle}`}
              className={`leaderboard__row${isMe(row) ? ' leaderboard__row--me' : ''}`}
              style={identityStyle(row.handle)}
            >
              <span className="leaderboard__rank">{row.rank}</span>
              <Avatar handle={row.handle} displayName={row.displayName} />
              <span className="leaderboard__who">
                <span className="leaderboard__who-line">
                  <span className="community__name">
                    {row.displayName || row.handle}
                  </span>
                  <span className="community__handle">@{row.handle}</span>
                  {roleTag(row)}
                </span>
                <span className="leaderboard__bar" aria-hidden="true">
                  <span
                    className="leaderboard__bar-fill"
                    style={{ width: `${share(row.points) * 100}%` }}
                  />
                </span>
                <LeaderboardStats score={row} hours={hoursOf(row.minutes)} />
              </span>
              <span className="leaderboard__points">
                {pointsOf(row.points)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {loading && rows.length === 0 && (
        <div className="leaderboard__skeleton" role="status">
          <span className="leaderboard__sr">{t('leaderboard.loading')}</span>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <span
              key={index}
              className="leaderboard__skeleton-row"
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      {!loading && rows.length === 0 && !error && (
        <div className="community__empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="board" />
          </span>
          <p className="community__empty-title">{t('leaderboard.empty')}</p>
        </div>
      )}

      {me && !meInTop && (
        <div className="leaderboard__me">
          <span className="leaderboard__me-rank">
            <span className="leaderboard__me-hash" aria-hidden="true">
              #
            </span>
            {me.rank}
          </span>
          <span className="leaderboard__me-text">
            <span className="community__name">{t('leaderboard.you')}</span>
            <span className="leaderboard__bar" aria-hidden="true">
              <span
                className="leaderboard__bar-fill"
                style={{ width: `${share(me.points) * 100}%` }}
              />
            </span>
            <LeaderboardStats score={me} hours={hoursOf(me.minutes)} />
          </span>
          <span className="leaderboard__points">{pointsOf(me.points)}</span>
        </div>
      )}
      {!me && !loading && !status.optedIn && (
        <div className="leaderboard__join">
          <span className="leaderboard__join-text">
            {t('leaderboard.notJoined')}
          </span>
          <button
            type="button"
            className="button small"
            onClick={requestAccountPanel}
          >
            {t('leaderboard.card.join')}
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <p className="leaderboard__scoring">{t('leaderboard.scoring')}</p>
      )}
    </div>
  );
}
