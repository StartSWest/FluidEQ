import { ipcMain } from 'electron';
import {
  isAccountConfigured,
  type IAccountConfig,
} from '../../common/accountConfig';
import { PLUS_TERMS_VERSION } from '../../common/plusTerms';
import {
  PLUS_TRIAL_TERMS_VERSION,
  type TPlusTrialOutcome,
  type TPlusTrialSettingsOutcome,
} from '../../common/plusTrial';
import type { IEntitlement } from '../account/entitlement';
import { AuthError } from '../account/authClient';
import type { IAccountSession } from '../account/session';
import {
  getPlusTrialOffer,
  getPlusTrialSettings,
  setPlusTrialOffer,
  startPlusTrial,
  type IPlusTrialAuth,
} from '../plus/trialApi';

const CHANNELS = [
  'plus-trial-offer',
  'plus-trial-start',
  'plus-trial-settings',
  'plus-trial-set-offer',
] as const;
const signedOut = () => ({ ok: false as const, reason: 'signed-out' as const });

export const registerPlusTrialIpc = ({
  config,
  session,
  entitlement,
  onTermsAgreed,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  entitlement: Pick<IEntitlement, 'expectChange' | 'checkNow'>;
  onTermsAgreed?: (version: number) => void;
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

  ipcMain.handle(
    'plus-trial-start',
    async (_event, raw: unknown): Promise<TPlusTrialOutcome> => {
      const acceptance =
        typeof raw === 'object' && raw !== null
          ? (raw as Record<string, unknown>)
          : {};
      if (acceptance.accepted !== true) {
        return { ok: false, reason: 'consent-required' };
      }
      if (
        acceptance.termsVersion !== PLUS_TERMS_VERSION ||
        acceptance.trialTermsVersion !== PLUS_TRIAL_TERMS_VERSION
      ) {
        return { ok: false, reason: 'terms-outdated' };
      }
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
      const outcome = await startPlusTrial(auth, {
        accepted: true,
        termsVersion: PLUS_TERMS_VERSION,
        trialTermsVersion: PLUS_TRIAL_TERMS_VERSION,
      });
      if (accountId() !== id) {
        return signedOut();
      }
      if (!outcome.ok) {
        return outcome;
      }
      if (outcome.offer.state !== 'active' && outcome.offer.state !== 'ended') {
        return { ok: false, reason: 'server' };
      }
      // Record the already-accepted text before membership listeners can ask
      // whether this new member owes a global terms notice.
      onTermsAgreed?.(PLUS_TERMS_VERSION);
      entitlement.expectChange();
      try {
        await entitlement.checkNow();
      } catch {
        return accountId() === id
          ? { ok: false, reason: 'server' }
          : signedOut();
      }
      return accountId() === id ? outcome : signedOut();
    },
  );

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
