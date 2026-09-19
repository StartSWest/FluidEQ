import type { TranslationKey } from 'common/i18n';
import type { TPlusTrialFailure } from 'common/plusTrial';

const TRIAL_ERRORS: Record<TPlusTrialFailure, TranslationKey> = {
  offline: 'trial.error.offline',
  'signed-out': 'trial.error.signedOut',
  server: 'trial.error.server',
  forbidden: 'trial.error.forbidden',
  ineligible: 'trial.error.ineligible',
  unavailable: 'trial.error.unavailable',
  'terms-outdated': 'trial.error.terms',
  'consent-required': 'trial.error.consent',
};
export default TRIAL_ERRORS;
