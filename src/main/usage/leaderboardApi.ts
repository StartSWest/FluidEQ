import type { IAccountConfig } from 'common/accountConfig';
import jwtSubject from '../account/jwtSubject';
import type { IPendingDay } from './usageLedger';

/**
 * The leaderboard's REST surface.
 *
 * An upload is one row per day holding two things, the date and that day's
 * whole minutes, replaced on conflict, so a day that keeps growing overwrites
 * its own earlier number rather than adding to it. The app version and the
 * language rode along once and are no longer sent: nothing read them, and
 * data nobody reads is still data somebody holds. The board and the caller's
 * own rank come from two database functions that return handles and scores
 * and nothing else — no ids, no days.
 */

export type TLeaderboardPeriod = 'all' | 'month';

/**
 * What a place on the board is made of. The server scores it — ten points an
 * hour, twenty an active day, five a message, ten for each person who
 * mentions you on a day — and hands back the parts so a row can say why.
 */
export interface ILeaderboardScore {
  points: number;
  minutes: number;
  activeDays: number;
  messages: number;
  mentions: number;
}

export interface ILeaderboardRow extends ILeaderboardScore {
  rank: number;
  handle: string;
  displayName: string;
  role: 'member' | 'contributor' | 'admin';
}

export interface IMyRank extends ILeaderboardScore {
  rank: number;
  players: number;
}

export type TLeaderboardFailure =
  'plus_required' | 'signed_out' | 'network' | 'rejected';

export class LeaderboardError extends Error {
  readonly failure: TLeaderboardFailure;

  constructor(failure: TLeaderboardFailure, message: string) {
    super(message);
    this.name = 'LeaderboardError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readInteger = (value: unknown): number | undefined => {
  // PostgREST hands `bigint` back as a string.
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number >= 0
    ? number
    : undefined;
};

/**
 * The score's parts, with the minutes mandatory and everything else zero
 * when absent — a server still on the hours-only board answers rows with
 * minutes alone, and those must keep reading.
 */
const readScore = (
  value: Record<string, unknown>,
): ILeaderboardScore | undefined => {
  const minutes = readInteger(value.minutes);
  if (minutes === undefined) {
    return undefined;
  }
  const optional = (field: unknown) => readInteger(field) ?? 0;
  return {
    minutes,
    activeDays: optional(value.active_days),
    messages: optional(value.messages),
    mentions: optional(value.mentions),
    // An old server has no points; hours alone are the score it ranked by.
    points: readInteger(value.points) ?? Math.floor(minutes / 6),
  };
};

export const readRow = (value: unknown): ILeaderboardRow | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const rank = readInteger(value.rank);
  const score = readScore(value);
  const handle = typeof value.handle === 'string' ? value.handle : undefined;
  if (rank === undefined || score === undefined || !handle) {
    return undefined;
  }
  return {
    rank,
    handle,
    displayName:
      typeof value.display_name === 'string' ? value.display_name : handle,
    role:
      value.role === 'admin' || value.role === 'contributor'
        ? value.role
        : 'member',
    ...score,
  };
};

export const readMyRank = (value: unknown): IMyRank | undefined => {
  const first = Array.isArray(value) ? value[0] : value;
  if (!isRecord(first)) {
    return undefined;
  }
  const rank = readInteger(first.rank);
  const score = readScore(first);
  const players = readInteger(first.players);
  return rank !== undefined && score !== undefined && players !== undefined
    ? { rank, players, ...score }
    : undefined;
};

export interface ILeaderboardApiOptions {
  config: IAccountConfig;
  accessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface ILeaderboardApi {
  uploadDays(days: readonly IPendingDay[]): Promise<void>;
  fetchBoard(period: TLeaderboardPeriod): Promise<ILeaderboardRow[]>;
  fetchMyRank(period: TLeaderboardPeriod): Promise<IMyRank | undefined>;
  /** Every row of mine, gone. */
  deleteMine(): Promise<void>;
}

export const createLeaderboardApi = ({
  config,
  accessToken,
  fetchImpl = fetch,
}: ILeaderboardApiOptions): ILeaderboardApi => {
  const request = async (
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    prefer?: string,
  ): Promise<unknown> => {
    let token: string;
    try {
      token = await accessToken();
    } catch {
      throw new LeaderboardError('signed_out', 'Nobody is signed in.');
    }
    let response: Response;
    try {
      response = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new LeaderboardError('network', `Unreachable: ${error}`);
    }
    if (response.status === 401) {
      throw new LeaderboardError('signed_out', 'Token refused.');
    }
    if (!response.ok) {
      let message = '';
      try {
        const parsed: unknown = await response.json();
        message =
          isRecord(parsed) && typeof parsed.message === 'string'
            ? parsed.message
            : '';
      } catch {
        message = '';
      }
      throw new LeaderboardError(
        message.includes('plus_required') ? 'plus_required' : 'rejected',
        `Answered ${response.status}`,
      );
    }
    if (response.status === 204) {
      return undefined;
    }
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  };

  const whoAmI = async (): Promise<string> => {
    let token: string;
    try {
      token = await accessToken();
    } catch {
      throw new LeaderboardError('signed_out', 'Nobody is signed in.');
    }
    const sub = jwtSubject(token);
    if (!sub) {
      throw new LeaderboardError('rejected', 'Token has no subject.');
    }
    return sub;
  };

  return {
    uploadDays: async (days) => {
      if (days.length === 0) {
        return;
      }
      // The id is the account's own, from its own token; the server replaces
      // it with the token's subject anyway, and the conflict target needs it.
      const userId = await whoAmI();
      await request(
        'POST',
        'usage_days?on_conflict=user_id,day',
        days.map((entry) => ({
          user_id: userId,
          day: entry.day,
          minutes: entry.minutes,
        })),
        'resolution=merge-duplicates,return=minimal',
      );
    },

    fetchBoard: async (period) => {
      const rows = await request('POST', 'rpc/leaderboard', { period });
      return Array.isArray(rows)
        ? rows
            .map(readRow)
            .filter((row): row is ILeaderboardRow => row !== undefined)
        : [];
    },

    fetchMyRank: async (period) =>
      readMyRank(await request('POST', 'rpc/my_rank', { period })),

    deleteMine: async () => {
      await request('DELETE', `usage_days?user_id=eq.${await whoAmI()}`);
    },
  };
};
