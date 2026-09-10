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
 * Where a score came from, as a row of small figures under the name: the
 * hours, the messages, and — only when there are any, because they are the
 * rarer thing — the people who mentioned them. Each picture is painted in its
 * part's colour, the same one the guide beside the board and the standing bar
 * use.
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
        className="leaderboard__stat leaderboard-part--messages"
        title={t('leaderboard.stat.messages', { count: score.messages })}
      >
        <Glyph name={PART_GLYPHS.messages} />
        {score.messages}
      </span>
      {score.mentions > 0 && (
        <span
          className="leaderboard__stat leaderboard-part--mentions"
          title={t('leaderboard.stat.mentions', { count: score.mentions })}
        >
          <Glyph name={PART_GLYPHS.mentions} />
          {score.mentions}
        </span>
      )}
    </span>
  );
}
