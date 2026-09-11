import { ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  HANDLE_PATTERN,
  MAX_DISPLAY_NAME,
  type IPlusProfile,
  type TProfileFailure,
} from '../../common/plusProfile';
import type { IAccountSession } from '../account/session';
import { createProfileApi, ProfileError } from '../plus/profileApi';

/**
 * The member's name, as the renderer sees it: read it, or choose it once.
 *
 * Every call answers `{ ok, value }` or `{ ok: false, failure }` rather than
 * throwing across the bridge, so "that handle is taken" survives the trip as
 * the word the panel has a sentence for.
 */

export interface IPlusProfileIpcDeps {
  config: IAccountConfig;
  session: IAccountSession;
  fetchImpl?: typeof fetch;
}

export type TPlusProfileResult<T> =
  { ok: true; value: T } | { ok: false; failure: TProfileFailure };

const CHANNELS = ['plus-profile', 'plus-create-profile'] as const;

const guard = async <T>(
  work: () => Promise<T>,
): Promise<TPlusProfileResult<T>> => {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return {
      ok: false,
      failure: error instanceof ProfileError ? error.failure : 'network',
    };
  }
};

export const registerPlusProfileIpc = ({
  config,
  session,
  fetchImpl,
}: IPlusProfileIpcDeps) => {
  const api = createProfileApi({
    config,
    accessToken: () => session.accessToken(),
    fetchImpl,
  });

  ipcMain.handle(
    'plus-profile',
    (): Promise<TPlusProfileResult<IPlusProfile | null>> =>
      // `null`, not `undefined`: "no name yet" has to survive the bridge as
      // an answer, distinct from no answer at all.
      guard(async () => (await api.mine()) ?? null),
  );

  ipcMain.handle(
    'plus-create-profile',
    (_event, handle: unknown, displayName: unknown) =>
      guard(async () => {
        const wanted =
          typeof handle === 'string' ? handle.trim().toLowerCase() : '';
        const name =
          typeof displayName === 'string'
            ? displayName.trim().slice(0, MAX_DISPLAY_NAME)
            : '';
        if (!HANDLE_PATTERN.test(wanted) || name.length === 0) {
          throw new ProfileError('rejected', 'Handle or name malformed.');
        }
        return api.create(wanted, name);
      }),
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
