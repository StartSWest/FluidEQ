import { ipcMain } from 'electron';
import {
  isAccountConfigured,
  type IAccountConfig,
} from '../../common/accountConfig';
import {
  type TPlusTrialFailure,
  type TPlusTrialOutcome,
  type TPlusTrialSettingsOutcome,
} from '../../common/plusTrial';
import { readTrialExitAnswer } from '../../common/trialExit';
import { AuthError } from '../account/authClient';
import type { IAccountSession } from '../account/session';
import {
  getPlusTrialOffer,
  getPlusTrialSettings,
  setPlusTrialOffer,
  type IPlusTrialAuth,
} from '../plus/trialApi';
import {
  getTrialExit,
  reportTrialExit,
  type TTrialExitOutcome,
  type TTrialExitReportOutcome,
} from '../plus/trialExitApi';

const CHANNELS = [
  'plus-trial-offer',
  'plus-trial-settings',
  'plus-trial-set-offer',
  'plus-trial-exit',
  'plus-trial-exit-report',
] as const;
const signedOut = () => ({ ok: false as const, reason: 'signed-out' as const });

export const registerPlusTrialIpc = ({
  config,
  session,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  fetchImpl?: typeof fetch;
}) => {
  const accountId = () => session.state().identity?.id;

  const authFor = async (
    id: string | undefined,
  ): Promise<
    IPlusTrialAuth | { ok: false; reason: 'signed-out' | 'offline' | 'server' }
  > => {
    if (!id) {
      return signedOut();
    }
    try {
      const accessToken = await session.accessToken();
      return accountId() === id && accessToken
        ? {
            config,
            accessToken,
            fetchImpl,
            isCurrent: () => accountId() === id,
          }
        : signedOut();
    } catch (error) {
      if (
        accountId() !== id ||
        (error instanceof AuthError &&
          (error.failure === 'expired' ||
            error.failure === 'signed_out_elsewhere'))
      ) {
        return signedOut();
      }
      return {
        ok: false,
        reason:
          error instanceof AuthError && error.failure !== 'network'
            ? 'server'
            : 'offline',
      };
    }
  };

  ipcMain.handle('plus-trial-offer', async (): Promise<TPlusTrialOutcome> => {
    if (!isAccountConfigured(config)) {
      return { ok: false, reason: 'unavailable' };
    }
    const id = accountId();
    const auth = id
      ? await authFor(id)
      : { config, fetchImpl, isCurrent: () => accountId() === undefined };
    if (accountId() !== id) {
      return signedOut();
    }
    if ('ok' in auth) {
      return auth;
    }
    const outcome = await getPlusTrialOffer(auth);
    if (accountId() !== id) {
      return signedOut();
    }
    if (
      !id &&
      outcome.ok &&
      outcome.offer.state !== 'sign-in' &&
      outcome.offer.state !== 'unavailable'
    ) {
      return { ok: false, reason: 'server' };
    }
    return outcome;
  });

  const settings = async (
    enabled?: boolean,
  ): Promise<TPlusTrialSettingsOutcome> => {
    if (!isAccountConfigured(config)) {
      return { ok: false, reason: 'unavailable' };
    }
    const id = accountId();
    const auth = await authFor(id);
    if (accountId() !== id) {
      return signedOut();
    }
    if ('ok' in auth) {
      return auth;
    }
    const outcome = await (enabled === undefined
      ? getPlusTrialSettings(auth)
      : setPlusTrialOffer(auth, enabled));
    return accountId() === id ? outcome : signedOut();
  };
  // The question asked once a trial ends without Plus (premium 0054).
  const withAuth = async <T>(
    act: (auth: IPlusTrialAuth & { accessToken: string }) => Promise<T>,
  ): Promise<T | { ok: false; reason: TPlusTrialFailure }> => {
    if (!isAccountConfigured(config)) {
      return { ok: false, reason: 'unavailable' };
    }
    const id = accountId();
    const auth = await authFor(id);
    if (accountId() !== id) {
      return signedOut();
    }
    if ('ok' in auth) {
      return auth;
    }
    if (!auth.accessToken) {
      return signedOut();
    }
    const outcome = await act({ ...auth, accessToken: auth.accessToken });
    return accountId() === id ? outcome : signedOut();
  };
  ipcMain.handle('plus-trial-exit', (): Promise<TTrialExitOutcome> =>
    withAuth(getTrialExit),
  );
  ipcMain.handle(
    'plus-trial-exit-report',
    (
      _event,
      reason: unknown,
      note: unknown,
    ): Promise<TTrialExitReportOutcome> => {
      const answer = readTrialExitAnswer(reason, note);
      return answer
        ? withAuth((auth) => reportTrialExit(auth, answer))
        : Promise.resolve({ ok: false, reason: 'forbidden' });
    },
  );

  ipcMain.handle('plus-trial-settings', () => settings());
  ipcMain.handle(
    'plus-trial-set-offer',
    (_event, enabled: unknown): Promise<TPlusTrialSettingsOutcome> =>
      typeof enabled === 'boolean'
        ? settings(enabled)
        : Promise.resolve({ ok: false, reason: 'forbidden' }),
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
