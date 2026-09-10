import type { ILeaderboardScore } from 'main/usage/leaderboardApi';
import { useTranslation } from '../utils/I18nContext';
import Glyph from './Glyph';

interface ILeaderboardStatsProps {
  score: ILeaderboardScore;
  /** Hours already formatted in the reader's number style. */
  hours: string;
}

/**
 * Where a score came from, as a row of small figures under the points: the
 * hours, the messages, and — only when there are any, because they are the
 * rare thing — the replies from the maker. The picture in front of each
 * figure is what makes three numbers readable at a glance.
 */
export default function LeaderboardStats({
  score,
  hours,
}: ILeaderboardStatsProps) {
  const { t } = useTranslation();
  return (
    <span className="leaderboard__stats">
      <span
        className="leaderboard__stat"
        title={t('leaderboard.stat.hours', { hours })}
      >
        <Glyph name="looks" />
        {t('leaderboard.hours', { hours })}
      </span>
      <span
        className="leaderboard__stat"
        title={t('leaderboard.stat.messages', { count: score.messages })}
      >
        <Glyph name="general" />
        {score.messages}
      </span>
      {score.replies > 0 && (
        <span
          className="leaderboard__stat leaderboard__stat--replies"
          title={t('leaderboard.stat.replies', { count: score.replies })}
        >
          <Glyph name="mention" />
          {score.replies}
        </span>
      )}
    </span>
  );
}
