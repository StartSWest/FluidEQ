/** The optional free month is separate from merchant trials and subscriptions. */
export const PLUS_TRIAL_PLAN = 'trial';
export const PLUS_TRIAL_DAYS = 30;
export const PLUS_TRIAL_TERMS_VERSION = 1;

export interface IPlusTrialOffer {
  enabled: boolean;
  days: typeof PLUS_TRIAL_DAYS;
  state:
    'unavailable' | 'sign-in' | 'eligible' | 'active' | 'ended' | 'ineligible';
  startedAt?: number;
  endsAt?: number;
  termsVersion: number;
  trialTermsVersion: number;
}

export interface IPlusTrialSettings {
  enabled: boolean;
  days: typeof PLUS_TRIAL_DAYS;
  eligibleSince?: number;
}

export interface IPlusTrialAcceptance {
  accepted: true;
  termsVersion: number;
  trialTermsVersion: number;
}

export type TPlusTrialFailure =
  | 'offline'
  | 'signed-out'
  | 'server'
  | 'forbidden'
  | 'consent-required'
  | 'ineligible'
  | 'unavailable'
  | 'terms-outdated';

export type TPlusTrialOutcome =
  | { ok: true; offer: IPlusTrialOffer }
  | { ok: false; reason: TPlusTrialFailure };

export type TPlusTrialSettingsOutcome =
  | { ok: true; settings: IPlusTrialSettings }
  | { ok: false; reason: TPlusTrialFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readDate = (value: unknown): number | undefined => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const invalidDate = (raw: unknown, parsed: number | undefined) =>
  raw !== null && raw !== undefined && parsed === undefined;

const STATES: IPlusTrialOffer['state'][] = [
  'unavailable',
  'sign-in',
  'eligible',
  'active',
  'ended',
  'ineligible',
];

/** Dates cross IPC as numbers; a malformed offer never becomes an invitation. */
export const parsePlusTrialOffer = (
  value: unknown,
): IPlusTrialOffer | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const state = STATES.find((candidate) => candidate === value.state);
  const startedAt = readDate(value.startedAt);
  const endsAt = readDate(value.endsAt);
  if (
    typeof value.enabled !== 'boolean' ||
    value.days !== PLUS_TRIAL_DAYS ||
    state === undefined ||
    typeof value.termsVersion !== 'number' ||
    !Number.isInteger(value.termsVersion) ||
    value.termsVersion <= 0 ||
    typeof value.trialTermsVersion !== 'number' ||
    !Number.isInteger(value.trialTermsVersion) ||
    value.trialTermsVersion <= 0 ||
    invalidDate(value.startedAt, startedAt) ||
    invalidDate(value.endsAt, endsAt) ||
    (startedAt === undefined) !== (endsAt === undefined) ||
    (startedAt !== undefined && endsAt !== undefined && endsAt <= startedAt) ||
    ((state === 'active' || state === 'ended') && startedAt === undefined) ||
    ((state === 'eligible' || state === 'sign-in') && !value.enabled)
  ) {
    return undefined;
  }
  return {
    enabled: value.enabled,
    days: PLUS_TRIAL_DAYS,
    state,
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    termsVersion: value.termsVersion,
    trialTermsVersion: value.trialTermsVersion,
  };
};

export const parsePlusTrialSettings = (
  value: unknown,
): IPlusTrialSettings | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const eligibleSince = readDate(value.eligibleSince);
  if (
    typeof value.enabled !== 'boolean' ||
    value.days !== PLUS_TRIAL_DAYS ||
    invalidDate(value.eligibleSince, eligibleSince) ||
    (value.enabled && eligibleSince === undefined)
  ) {
    return undefined;
  }
  return {
    enabled: value.enabled,
    days: PLUS_TRIAL_DAYS,
    ...(eligibleSince !== undefined ? { eligibleSince } : {}),
  };
};
