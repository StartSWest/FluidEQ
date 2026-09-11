import type { ILeaderboardScore } from 'main/usage/leaderboardApi';
import { useTranslation } from '../utils/I18nContext';
import Glyph from './Glyph';
import { PART_GLYPHS } from './leaderboardParts';

interface ILeaderboardStatsProps {
  score: ILeaderboardScore;
  /** Hours already formatted in the reader's number style. */
  hours: string;
}

/**
 * Where a score came from, as a row of small figures under the name — the
 * same three things the points are made of: the hours, the active days, and,
 * only when there are any because most members make no scenes, the likes on
 * the scenes they made. Each picture is painted in its part's colour, the
 * same one the guide beside the board and the standing bar use.
 */
export default function LeaderboardStats({
  score,
  hours,
}: ILeaderboardStatsProps) {
  const { t } = useTranslation();
  return (
    <span className="leaderboard__stats">
      <span
        className="leaderboard__stat leaderboard-part--hours"
        title={t('leaderboard.stat.hours', { hours })}
      >
        <Glyph name={PART_GLYPHS.hours} />
        {t('leaderboard.hours', { hours })}
      </span>
      <span
        className="leaderboard__stat leaderboard-part--days"
        title={t('leaderboard.stat.days', { count: score.activeDays })}
      >
        <Glyph name={PART_GLYPHS.days} />
        {score.activeDays}
      </span>
      {score.likes > 0 && (
        <span
          className="leaderboard__stat leaderboard-part--likes"
          title={t('leaderboard.stat.likes', { count: score.likes })}
        >
          <Glyph name={PART_GLYPHS.likes} />
          {score.likes}
        </span>
      )}
    </span>
  );
}
