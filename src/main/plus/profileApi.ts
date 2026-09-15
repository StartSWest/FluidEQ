import type { IAccountConfig } from 'common/accountConfig';
import {
  MAX_DISPLAY_NAME,
  MAX_HANDLE,
  type IPlusProfile,
  type TProfileFailure,
} from '../../common/plusProfile';
import jwtSubject from '../account/jwtSubject';

/**
 * The member's name: the @handle and display name the leaderboard ranks and
 * the Visualizers gallery credits.
 *
 * It lives in the server's `profiles` table, which is also the parent row of
 * every day of listening a computer reports — so a member has to choose one
 * before the board can count them. Anyone signed in may read every profile;
 * each account may create and change only its own, and the role on it is the
 * admin's to give. Those rules are policies in the database; this module only
 * carries the request and reads the answer.
 */

export class ProfileError extends Error {
  readonly failure: TProfileFailure;

  constructor(failure: TProfileFailure, message: string) {
    super(message);
    this.name = 'ProfileError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;

export const readProfile = (value: unknown): IPlusProfile | undefined => {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) {
    return undefined;
  }
  const userId = readString(row.user_id, 64);
  const handle = readString(row.handle, MAX_HANDLE);
  const displayName = readString(row.display_name, MAX_DISPLAY_NAME);
  if (!userId || !handle || !displayName) {
    return undefined;
  }
  return {
    userId,
    handle,
    displayName,
    // Any role this app does not know — "contributor" on a server that has
    // not dropped it yet — is a member here.
    role: row.role === 'admin' ? 'admin' : 'member',
  };
};

/** What is asked for, never `*`: a column added later is not sent by default. */
const COLUMNS = 'user_id,handle,display_name,role';

const failureOf = (code: unknown, word: unknown): TProfileFailure => {
  if (code === '23505') {
    return 'handle_taken';
  }
  if (code === '22023' && word === 'reserved_name') {
    return 'name_reserved';
  }
  if (code === '22023' && word === 'bad_display_name') {
    return 'name_unreadable';
  }
  return 'rejected';
};

export interface IProfileApiOptions {
  config: IAccountConfig;
  /** A usable access token, or a rejection when nobody is signed in. */
  accessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface IProfileApi {
  /** This account's profile, or undefined when it has not chosen a name. */
  mine(): Promise<IPlusProfile | undefined>;
  create(handle: string, displayName: string): Promise<IPlusProfile>;
  /**
   * Changes the name already chosen. The board, the gallery's credits and
   * every scene page read the profile when they are asked, so the new name
   * is everywhere at once; the same rules and refusals as choosing it.
   */
  update(handle: string, displayName: string): Promise<IPlusProfile>;
}

export const createProfileApi = ({
  config,
  accessToken,
  fetchImpl = fetch,
}: IProfileApiOptions): IProfileApi => {
  const token = async (): Promise<string> => {
    try {
      return await accessToken();
    } catch {
      throw new ProfileError('signed_out', 'Nobody is signed in.');
    }
  };

  const request = async (
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<unknown> => {
    const bearer = await token();
    let response: Response;
    try {
      response = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json',
          ...(body !== undefined
            ? {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ProfileError('network', `Unreachable: ${error}`);
    }
    if (response.status === 401) {
      throw new ProfileError('signed_out', 'Token refused.');
    }
    if (!response.ok) {
      // A unique-key collision on the handle is PostgREST's code 23505; the
      // name rules (server migration 0022) raise 22023 with their word.
      let code: unknown;
      let word: unknown;
      try {
        const parsed: unknown = await response.json();
        code = isRecord(parsed) ? parsed.code : undefined;
        word = isRecord(parsed) ? parsed.message : undefined;
      } catch {
        code = undefined;
      }
      throw new ProfileError(
        failureOf(code, word),
        `Answered ${response.status}`,
      );
    }
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  };

  const whoAmI = async (): Promise<string> => {
    const sub = jwtSubject(await token());
    if (!sub) {
      throw new ProfileError('rejected', 'Token has no subject.');
    }
    return sub;
  };

  return {
    mine: async () =>
      readProfile(
        await request(
          'GET',
          `profiles?select=${COLUMNS}&user_id=eq.${await whoAmI()}`,
        ),
      ),

    create: async (handle, displayName) => {
      const row = {
        user_id: await whoAmI(),
        handle,
        display_name: displayName,
      };
      const created = readProfile(
        await request('POST', `profiles?select=${COLUMNS}`, [row]),
      );
      if (!created) {
        throw new ProfileError('rejected', 'The profile did not come back.');
      }
      return created;
    },

    update: async (handle, displayName) => {
      // Only this account's row: the policy refuses any other, and the
      // filter keeps a wrong-account answer from reading as success.
      const changed = readProfile(
        await request(
          'PATCH',
          `profiles?select=${COLUMNS}&user_id=eq.${await whoAmI()}`,
          { handle, display_name: displayName },
        ),
      );
      if (!changed) {
        throw new ProfileError('rejected', 'The profile did not come back.');
      }
      return changed;
    },
  };
};
