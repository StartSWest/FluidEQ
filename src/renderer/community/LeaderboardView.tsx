import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import type {
  ILeaderboardRow,
  TLeaderboardFailure,
  TLeaderboardPeriod,
} from 'main/usage/leaderboardApi';
import { requestAccountPanel } from '../account/accountPanel';
import { useEntitlement } from '../account/entitlementStore';
import { useProfile } from '../plus/profileStore';
import { useTranslation } from '../utils/I18nContext';
import { loadLeaderboard, useLeaderboard } from '../usage/leaderboardStore';
import Avatar from './Avatar';
import Glyph from './Glyph';
import LeaderboardGuide from './LeaderboardGuide';
import LeaderboardName from './LeaderboardName';
import LeaderboardStanding from './LeaderboardStanding';
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
 * Your standing first, when you are on the board: the rank, the points and
 * what they are made of, and how far the next person is. Then the top three on
 * a podium — first in the middle, a step higher and crowned, the way every
 * podium is read, with gold, silver and bronze on the ranks — and everyone
 * else as a row whose own background fills to their share of the leader's
 * points, so the shape of the board is visible before a number is read. How
 * points are earned stands beside it on a wide pane and under it on a narrow
 * one, each part in the colour it wears everywhere else.
 */
export default function LeaderboardView() {
  const { t, locale } = useTranslation();
  const { board, loading, error, status } = useLeaderboard();
  const entitlement = useEntitlement();
  const profile = useProfile();
  const [period, setPeriod] = useState<TLeaderboardPeriod>('all');
  // The board is Plus's, and it counts a member only under a name: a member
  // without one is asked for it here, where the reason is on screen.
  const needsName =
    entitlement.state !== 'none' && profile.loaded && !profile.profile;

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
  const leader = rows[0]?.points ?? 0;
  const shareOf = (points: number) =>
    leader > 0 ? Math.max(3, (points / leader) * 100) : 0;

  const podium = rows.slice(0, PODIUM);
  const rest = rows.slice(PODIUM);
  const isMe = (row: ILeaderboardRow) =>
    me !== undefined && row.rank === me.rank && row.points === me.points;

  const roleTag = (row: ILeaderboardRow) =>
    row.role === 'admin' && (
      <span className="community__role community__role--admin">
        {t('leaderboard.role.admin')}
      </span>
    );

  const youTag = (row: ILeaderboardRow) =>
    isMe(row) && (
      <span className="leaderboard__you">{t('leaderboard.you')}</span>
    );

  return (
    <div className="leaderboard">
      <div className="leaderboard__inner">
        {/* Across both columns: the period and the count are the whole
            board's, and the guide beside it then starts level with the
            standing card instead of with the tabs. */}
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

        <div className="leaderboard__main">
          {error && (
            <p className="leaderboard__error" role="alert">
              {t(ERROR_KEYS[error])}
            </p>
          )}

          {needsName && (
            <LeaderboardName
              onSaved={() => {
                loadLeaderboard(period).catch(() => undefined);
              }}
            />
          )}

          {me && <LeaderboardStanding me={me} rows={rows} />}

          {podium.length > 0 && (
            <ol className="leaderboard__podium">
              {podium.map((row) => (
                <li
                  key={`${row.rank}-${row.handle}`}
                  className={`leaderboard__place leaderboard__place--${row.rank}${isMe(row) ? ' is-me' : ''}`}
                  style={identityStyle(row.handle)}
                >
                  {row.rank === 1 && (
                    <span className="leaderboard__crown" aria-hidden="true">
                      <Glyph name="crown" />
                    </span>
                  )}
                  <span
                    className={`leaderboard__medal leaderboard__medal--${row.rank}`}
                  >
                    {row.rank}
                  </span>
                  <Avatar
                    handle={row.handle}
                    displayName={row.displayName}
                    size="podium"
                  />
                  <span className="leaderboard__place-name community__name community__name--hued">
                    {row.displayName || row.handle}
                  </span>
                  <span className="community__handle">@{row.handle}</span>
                  <span className="leaderboard__place-tags">
                    {roleTag(row)}
                    {youTag(row)}
                  </span>
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
                  style={
                    {
                      ...identityStyle(row.handle),
                      '--share': `${shareOf(row.points)}%`,
                    } as CSSProperties
                  }
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
                      {youTag(row)}
                    </span>
                    <LeaderboardStats
                      score={row}
                      hours={hoursOf(row.minutes)}
                    />
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
              <span className="leaderboard__sr">
                {t('leaderboard.loading')}
              </span>
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

          {!me && !loading && !status.optedIn && (
            <div className="leaderboard__join">
              <span className="leaderboard__join-text">
                {t('leaderboard.notJoined')}
              </span>
              <button
                type="button"
                className="button small"
                onClick={() => requestAccountPanel()}
              >
                {t('leaderboard.card.join')}
              </button>
            </div>
          )}
        </div>

        <LeaderboardGuide />
      </div>
    </div>
  );
}
