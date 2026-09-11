import { useMemo } from 'react';
import { SCORE_PARTS, scoreParts } from 'common/leaderboardScore';
import type { ILeaderboardRow, IMyRank } from 'main/usage/leaderboardApi';
import { useTranslation } from '../utils/I18nContext';
import { PART_KEYS } from './leaderboardParts';
import '../styles/LeaderboardStanding.scss';

interface ILeaderboardStandingProps {
  me: IMyRank;
  /** The board as shown, to find the one person just ahead. */
  rows: readonly ILeaderboardRow[];
}

/**
 * Where you stand, at the top of the board.
 *
 * The rank large, the points beside it, and a bar split into the three
 * things the points came from — listening, active days, likes on your
 * scenes — each in the colour the guide beside the board uses, so the bar
 * reads as "this is how I got here" without a key being learned.
 * Under it, the one sentence that makes a board worth opening twice: how far
 * the next person up is. Ties need one point more, which is what "pass" means.
 */
export default function LeaderboardStanding({
  me,
  rows,
}: ILeaderboardStandingProps) {
  const { t, locale } = useTranslation();
  const numbers = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const parts = scoreParts(me);
  const earned = SCORE_PARTS.filter((part) => parts[part] > 0);
  const ahead = [...rows].reverse().find((row) => row.points > me.points);

  return (
    <section
      className="leaderboard-standing"
      aria-labelledby="leaderboard-standing-title"
    >
      <div className="leaderboard-standing__rank">
        <span className="leaderboard-standing__number">
          <span className="leaderboard-standing__hash" aria-hidden="true">
            #
          </span>
          {numbers.format(me.rank)}
        </span>
        <span className="leaderboard-standing__of">
          {t('leaderboard.hero.of', { count: numbers.format(me.players) })}
        </span>
      </div>

      <div className="leaderboard-standing__body">
        <div className="leaderboard-standing__head">
          <span id="leaderboard-standing-title" className="eyebrow">
            {t('leaderboard.hero.title')}
          </span>
          <span className="leaderboard-standing__points">
            {t('leaderboard.points', { points: numbers.format(me.points) })}
          </span>
        </div>

        <div className="leaderboard-standing__bar" aria-hidden="true">
          {earned.map((part) => (
            <span
              key={part}
              className={`leaderboard-standing__segment leaderboard-part--${part}`}
              style={{ flexGrow: parts[part] }}
            />
          ))}
        </div>

        <ul className="leaderboard-standing__legend">
          {SCORE_PARTS.map((part) => (
            <li
              key={part}
              className={`leaderboard-part--${part}${parts[part] > 0 ? '' : ' is-empty'}`}
            >
              <span className="leaderboard-standing__dot" aria-hidden="true" />
              {t(PART_KEYS[part])}
              <strong>{numbers.format(parts[part])}</strong>
            </li>
          ))}
        </ul>

        {(ahead || me.rank === 1) && (
          <p className="leaderboard-standing__next">
            {ahead
              ? t('leaderboard.hero.toPass', {
                  points: numbers.format(ahead.points - me.points + 1),
                  name: ahead.displayName || ahead.handle,
                })
              : t('leaderboard.hero.leading')}
          </p>
        )}
      </div>
    </section>
  );
}
