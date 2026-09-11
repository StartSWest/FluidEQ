import { scoreOf } from '../../common/leaderboardScore';
import type { ILeaderboardRow, IMyRank } from '../usage/leaderboardApi';

/**
 * People, for development.
 *
 * A fixed cast for reviewing the leaderboard's colours, podium and bars.
 * The visualizer gallery always uses real creators and published scenes.
 *
 * DEVELOPMENT ONLY: `main.ts` switches it on from a shell variable and never
 * in a packaged build. The real board stays exactly as the server sent it;
 * the cast is merged in, never written anywhere.
 */

export interface ISamplePerson {
  handle: string;
  displayName: string;
  /** Minutes of listening, all time and this month. */
  allTime: number;
  month: number;
  /** Days with at least half an hour played, all time and this month. */
  activeDays: number;
  activeDaysMonth: number;
  /** Likes on the scenes they made, all time. */
  likes: number;
}

const HOUR = 60;

/** One row of the cast: name, hours, active days, then likes. */
const person = (
  handle: string,
  displayName: string,
  hours: [allTime: number, month: number],
  days: [allTime: number, month: number],
  likes: number,
): ISamplePerson => ({
  handle,
  displayName,
  allTime: hours[0] * HOUR,
  month: hours[1] * HOUR,
  activeDays: days[0],
  activeDaysMonth: days[1],
  likes,
});

// Most of the cast makes no scenes; the few who do have likes, so a maker can
// climb past somebody who only listens more.
export const SAMPLE_PEOPLE: readonly ISamplePerson[] = [
  person('ada', 'Ada Lovelace', [812, 96], [210, 24], 0),
  person('mei', 'Mei Tanaka', [640, 71], [160, 19], 12),
  person('kwame', 'Kwame Mensah', [521, 58], [140, 17], 0),
  person('lena_k', 'Lena Kowalski', [402, 44], [120, 15], 0),
  person('ravi', 'Ravi Patel', [377, 39], [95, 12], 0),
  person('sol', 'Sol Martínez', [290, 31], [80, 10], 0),
  person('nia', 'Nia Okafor', [210, 22], [66, 9], 0),
  person('jonas', 'Jonas Berg', [168, 18], [51, 7], 0),
  person('yuki', 'Yuki Sato', [121, 14], [40, 6], 38),
  person('tom_h', 'Tom Hardy', [96, 9], [30, 4], 0),
  person('aisha', 'Aisha Rahman', [73, 7], [22, 3], 0),
  person('diego', 'Diego Ruiz', [41, 4], [12, 2], 0),
];

/**
 * The real board with the sample people ranked into it. Ranks are recomputed
 * over the merged list, the top hundred is kept, and the reader's own place
 * moves down by however many sample people out-scored them.
 */
export const sampleBoard = (
  period: 'all' | 'month',
  real: readonly ILeaderboardRow[],
  me: IMyRank | undefined,
): { rows: ILeaderboardRow[]; me: IMyRank | undefined } => {
  const month = period === 'month';
  const sample: ILeaderboardRow[] = SAMPLE_PEOPLE.map((entry) => {
    // Likes this month are a slice of all time, in the same proportion as
    // the hours, so the monthly board is not the all-time one in disguise.
    const share = month ? entry.month / entry.allTime : 1;
    const score = {
      minutes: month ? entry.month : entry.allTime,
      activeDays: month ? entry.activeDaysMonth : entry.activeDays,
      likes: Math.round(entry.likes * share),
    };
    return {
      rank: 0,
      handle: entry.handle,
      displayName: entry.displayName,
      role: 'member',
      ...score,
      points: scoreOf(score),
    };
  });
  const rows = [...real, ...sample]
    .sort((a, b) => b.points - a.points)
    .slice(0, 100)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const mine =
    me &&
    ({
      ...me,
      rank: me.rank + sample.filter((row) => row.points > me.points).length,
      players: me.players + sample.length,
    } satisfies IMyRank);
  return { rows, me: mine };
};
