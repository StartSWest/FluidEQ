/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TCreatorFailure } from 'common/creatorPayouts';

/** What a creator is told when the server or Stripe says no. */
export const CREATOR_ERRORS: Record<TCreatorFailure, TranslationKey> = {
  'signed-out': 'creator.error.signedOut',
  unconfirmed: 'creator.error.unconfirmed',
  offline: 'creator.error.offline',
  unavailable: 'creator.error.unavailable',
  'agreement-outdated': 'creator.error.agreementOutdated',
  country: 'creator.error.country',
  banned: 'creator.error.banned',
  server: 'creator.error.server',
};
