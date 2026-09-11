import { scoreOf } from '../../common/leaderboardScore';
import type { ILeaderboardRow, IMyRank } from '../usage/leaderboardApi';
import type { ICommunityMessage, TCommunityRole } from './communityApi';

/**
 * A community with people in it, for development.
 *
 * A chat with one member and a leaderboard with one name show none of what
 * the design is for — the colours per person, the podium, the bars, a turn
 * continuing, a mention lighting up. This is a fixed cast of people and what
 * they said, laid over the real content so the panels can be looked at full.
 *
 * DEVELOPMENT ONLY: `main.ts` switches it on from a shell variable and never
 * in a packaged build. Everything here is marked so it can never be mistaken
 * for the real thing by the code around it — user ids carry a `sample:`
 * prefix, message ids are negative — and the two IPC layers answer "done"
 * for a delete or a report of a sample row without asking the server. The
 * real messages and the real board stay exactly as the server sent them; the
 * sample is merged in, never written anywhere.
 */

export interface ISamplePerson {
  handle: string;
  displayName: string;
  role: TCommunityRole;
  /** Minutes of listening, all time and this month. */
  allTime: number;
  month: number;
  /** Days with at least half an hour played, all time and this month. */
  activeDays: number;
  activeDaysMonth: number;
  /**
   * Messages posted, people who mentioned them once a day, and likes on the
   * scenes they made: all time.
   */
  messages: number;
  mentions: number;
  likes: number;
}

const HOUR = 60;

/** One row of the cast: name, role, hours, then activity as the server counts it. */
const person = (
  handle: string,
  displayName: string,
  role: TCommunityRole,
  hours: [allTime: number, month: number],
  days: [allTime: number, month: number],
  activity: [messages: number, mentions: number, likes: number],
): ISamplePerson => ({
  handle,
  displayName,
  role,
  allTime: hours[0] * HOUR,
  month: hours[1] * HOUR,
  activeDays: days[0],
  activeDaysMonth: days[1],
  messages: activity[0],
  mentions: activity[1],
  likes: activity[2],
});

// Most of the cast makes no scenes; the few who do are the ones whose lines
// talk about looks, so the board and the chat tell the same story.
export const SAMPLE_PEOPLE: readonly ISamplePerson[] = [
  person(
    'ada',
    'Ada Lovelace',
    'contributor',
    [812, 96],
    [210, 24],
    [34, 17, 0],
  ),
  person('mei', 'Mei Tanaka', 'member', [640, 71], [160, 19], [21, 10, 12]),
  person('kwame', 'Kwame Mensah', 'member', [521, 58], [140, 17], [9, 3, 0]),
  person(
    'lena_k',
    'Lena Kowalski',
    'contributor',
    [402, 44],
    [120, 15],
    [28, 14, 0],
  ),
  person('ravi', 'Ravi Patel', 'member', [377, 39], [95, 12], [6, 1, 0]),
  person('sol', 'Sol Martínez', 'member', [290, 31], [80, 10], [14, 6, 0]),
  person('nia', 'Nia Okafor', 'member', [210, 22], [66, 9], [7, 4, 0]),
  person('jonas', 'Jonas Berg', 'member', [168, 18], [51, 7], [4, 1, 0]),
  person('yuki', 'Yuki Sato', 'member', [121, 14], [40, 6], [5, 3, 38]),
  person('tom_h', 'Tom Hardy', 'member', [96, 9], [30, 4], [3, 0, 0]),
  person('aisha', 'Aisha Rahman', 'member', [73, 7], [22, 3], [2, 1, 0]),
  person('diego', 'Diego Ruiz', 'member', [41, 4], [12, 2], [1, 0, 0]),
];

interface ISampleLine {
  handle: string;
  /** Minutes before "now" the line was said. */
  minutesAgo: number;
  /** `{me}` is replaced by the signed-in handle, so a mention lights up. */
  body: string;
}

const MINUTE_MS = 60 * 1000;
const DAY = 24 * 60;

const LINES: Readonly<Record<string, readonly ISampleLine[]>> = {
  general: [
    {
      handle: 'ada',
      minutesAgo: 2 * DAY + 190,
      body: 'Hello from Berlin. Been running FluidEQ on a pair of HD 650s for a month and the auto normalize alone was worth it.',
    },
    {
      handle: 'mei',
      minutesAgo: 2 * DAY + 60,
      body: 'Same here, on a Kraken V4. Does anyone else keep the response graph fullscreen on a second monitor? It has become my desk lamp.',
    },
    {
      handle: 'mei',
      minutesAgo: 2 * DAY + 58,
      body: 'Aurora at night is unreasonably good.',
    },
    {
      handle: 'kwame',
      minutesAgo: DAY + 400,
      body: 'New here. Coming from Equalizer APO on its own — the profile per output device is the thing I did not know I needed.',
    },
    {
      handle: 'lena_k',
      minutesAgo: DAY + 30,
      body: 'Welcome @kwame. Try the voicing quick picks before touching bands; Warm on closed-backs fixes most of what people reach for the EQ for.',
    },
    {
      handle: 'ravi',
      minutesAgo: 300,
      body: 'Karaoke mode with the family last night. My daughter now believes she is on the leaderboard for singing. She is not. Yet.',
    },
    {
      handle: 'sol',
      minutesAgo: 140,
      body: '@{me} the new picker with the Plus looks at the end is exactly right — you can see what you are missing without being nagged.',
    },
    {
      handle: 'nia',
      minutesAgo: 25,
      body: 'Anyone streaming to a second output over the network? Latency question in #help.',
    },
  ],
  looks: [
    {
      handle: 'ada',
      minutesAgo: 2 * DAY + 120,
      body: 'Ember with a live drummer is something else. The waveform along the flame front means every hit shows up as a lick.',
    },
    {
      handle: 'yuki',
      minutesAgo: DAY + 600,
      body: 'Made a custom look: Truss in the ocean palette with the glow turned down. Attaching once uploads are a thing.',
    },
    {
      handle: 'lena_k',
      minutesAgo: DAY + 590,
      body: 'That sounds lovely @yuki. Truss with the cables draping is my favourite of the free ones.',
    },
    {
      handle: 'tom_h',
      minutesAgo: 420,
      body: 'Prism on a treble-heavy track turns into a violet fan. Chrome is quieter but the accent strip on the ripples follows the theme colour, which I did not expect.',
    },
    {
      handle: 'mei',
      minutesAgo: 75,
      body: 'Vote for the next Plus look: something with water, something with cities, or something with stars? I want stars.',
    },
    { handle: 'aisha', minutesAgo: 12, body: 'Stars.' },
  ],
  help: [
    {
      handle: 'jonas',
      minutesAgo: DAY + 200,
      body: 'Preamp shows -7 dB and I cannot move it. Is that the auto normalize?',
    },
    {
      handle: 'lena_k',
      minutesAgo: DAY + 190,
      body: 'Yes — it sets the headroom for you so nothing clips. Turn Auto normalize off in the sidebar if you want to set it by hand.',
    },
    { handle: 'jonas', minutesAgo: DAY + 185, body: 'That was it. Thanks.' },
    {
      handle: 'nia',
      minutesAgo: 24,
      body: 'Second output over the network sits about 80 ms behind the first. Is that expected on Wi-Fi, or is something misconfigured?',
    },
    {
      handle: 'diego',
      minutesAgo: 9,
      body: 'Wi-Fi to a phone is around that for me too. Wired it drops to nothing you can hear.',
    },
  ],
  'feature-requests': [
    {
      handle: 'ada',
      minutesAgo: 3 * DAY,
      body: 'A per-app EQ profile — one for the game, one for the call — that switches when the window in front changes.',
    },
    {
      handle: 'lena_k',
      minutesAgo: 2 * DAY + 20,
      body: 'Export the current look as a wallpaper-sized still. Half of what I do with the graph fullscreen is take screenshots of it.',
    },
    {
      handle: 'ada',
      minutesAgo: 400,
      body: 'And a small one: a keyboard shortcut for the next look that works while another app has focus, like the media keys.',
    },
  ],
};

/** Stable and never a real id: the server counts up from one. */
const sampleMessageId = (channelId: string, index: number) =>
  -(1000 + channelId.length * 100 + index);

export const isSampleMessageId = (id: number) => id < 0;
export const isSampleUserId = (userId: string) => userId.startsWith('sample:');

const personByHandle = (handle: string): ISamplePerson => {
  const person = SAMPLE_PEOPLE.find((entry) => entry.handle === handle);
  if (!person) {
    throw new Error(`No sample person named ${handle}.`);
  }
  return person;
};

/**
 * The sample lines of one channel, timed relative to now. `meHandle` is
 * written into the one line that names the reader, so the mention highlight
 * has something to highlight.
 */
export const sampleMessages = (
  channelId: string,
  meHandle: string,
  now = Date.now(),
): ICommunityMessage[] =>
  (LINES[channelId] ?? []).map((line, index) => {
    const person = personByHandle(line.handle);
    return {
      id: sampleMessageId(channelId, index),
      channelId,
      userId: `sample:${person.handle}`,
      handle: person.handle,
      displayName: person.displayName,
      role: person.role,
      body: line.body.replace('{me}', meHandle),
      createdAt: now - line.minutesAgo * MINUTE_MS,
    };
  });

/**
 * The real board with the sample people ranked into it. Ranks are recomputed
 * over the merged list, the top hundred is kept, and the reader's own place
 * moves down by however many sample people out-listened them.
 */
export const sampleBoard = (
  period: 'all' | 'month',
  real: readonly ILeaderboardRow[],
  me: IMyRank | undefined,
): { rows: ILeaderboardRow[]; me: IMyRank | undefined } => {
  const month = period === 'month';
  const sample: ILeaderboardRow[] = SAMPLE_PEOPLE.map((entry) => {
    // Activity this month is a slice of all time, in the same proportion as
    // the hours, so the monthly board is not the all-time one in disguise.
    const share = month ? entry.month / entry.allTime : 1;
    const score = {
      minutes: month ? entry.month : entry.allTime,
      activeDays: month ? entry.activeDaysMonth : entry.activeDays,
      messages: Math.round(entry.messages * share),
      mentions: Math.round(entry.mentions * share),
      likes: Math.round(entry.likes * share),
    };
    return {
      rank: 0,
      handle: entry.handle,
      displayName: entry.displayName,
      role: entry.role,
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
