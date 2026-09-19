import {
  parsePlusTrialOffer,
  parsePlusTrialSettings,
  type IPlusTrialAcceptance,
  type TPlusTrialFailure,
  type TPlusTrialOutcome,
  type TPlusTrialSettingsOutcome,
} from '../../common/plusTrial';
import type { IGalleryAuth } from './galleryAccess';
import { rpc } from './galleryApi';

export interface IPlusTrialAuth extends Omit<IGalleryAuth, 'accessToken'> {
  /** Absent only for the public, generic offer. Never sent to the renderer. */
  accessToken?: string;
  /** Rechecked after every network await, including reading the response body. */
  isCurrent(): boolean;
}

const failed = (reason: TPlusTrialFailure) => ({ ok: false as const, reason });

const failureOf = (status: number, body: unknown): TPlusTrialFailure => {
  const raw =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  if (
    status === 401 ||
    raw.code === '28000' ||
    raw.code === 'PGRST301' ||
    raw.message === 'authentication_required'
  ) {
    return 'signed-out';
  }
  if (raw.message === 'terms_outdated') {
    return 'terms-outdated';
  }
  if (raw.message === 'trial_unavailable') {
    return 'unavailable';
  }
  if (raw.message === 'trial_ineligible') {
    return 'ineligible';
  }
  return status === 403 || raw.code === '42501' ? 'forbidden' : 'server';
};

const read = async <T>(
  auth: IPlusTrialAuth,
  name: string,
  body: Record<string, unknown>,
  parse: (value: unknown) => T | undefined,
): Promise<
  { ok: true; value: T } | { ok: false; reason: TPlusTrialFailure }
> => {
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  let response: Response;
  try {
    response = await (auth.accessToken
      ? rpc({ ...auth, accessToken: auth.accessToken }, name, body)
      : (auth.fetchImpl ?? fetch)(
          new URL(`/rest/v1/rpc/${name}`, auth.config.supabaseUrl).toString(),
          {
            method: 'POST',
            headers: {
              apikey: auth.config.supabaseAnonKey,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(body),
          },
        ));
  } catch {
    return failed(auth.isCurrent() ? 'offline' : 'signed-out');
  }
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return failed(
      auth.isCurrent() ? failureOf(response.status, undefined) : 'signed-out',
    );
  }
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  if (!response.ok) {
    return failed(failureOf(response.status, value));
  }
  const parsed = parse(value);
  return parsed === undefined ? failed('server') : { ok: true, value: parsed };
};

export const getPlusTrialOffer = async (
  auth: IPlusTrialAuth,
): Promise<TPlusTrialOutcome> => {
  const result = await read(auth, 'plus_trial_offer', {}, parsePlusTrialOffer);
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  return result.ok ? { ok: true, offer: result.value } : result;
};

export const startPlusTrial = async (
  auth: IPlusTrialAuth,
  acceptance: IPlusTrialAcceptance,
): Promise<TPlusTrialOutcome> => {
  const result = await read(
    auth,
    'start_plus_trial',
    {
      p_terms_version: acceptance.termsVersion,
      p_trial_terms_version: acceptance.trialTermsVersion,
    },
    parsePlusTrialOffer,
  );
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  return result.ok ? { ok: true, offer: result.value } : result;
};

export const getPlusTrialSettings = async (
  auth: IPlusTrialAuth,
): Promise<TPlusTrialSettingsOutcome> => {
  const result = await read(
    auth,
    'admin_plus_trial_settings',
    {},
    parsePlusTrialSettings,
  );
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  return result.ok ? { ok: true, settings: result.value } : result;
};

export const setPlusTrialOffer = async (
  auth: IPlusTrialAuth,
  enabled: boolean,
): Promise<TPlusTrialSettingsOutcome> => {
  const result = await read(
    auth,
    'admin_set_plus_trial_offer',
    { p_enabled: enabled },
    parsePlusTrialSettings,
  );
  if (!auth.isCurrent()) {
    return failed('signed-out');
  }
  return result.ok ? { ok: true, settings: result.value } : result;
};
