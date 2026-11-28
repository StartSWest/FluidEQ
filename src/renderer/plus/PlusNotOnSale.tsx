/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISubscriptionState } from 'common/subscription';
import { useTranslation } from '../utils/I18nContext';

/**
 * In a development build only: why no Plus shows for this account. While
 * Stripe is in test mode the server offers its test prices to the admin and
 * to the accounts on its testers list alone (premium 0123), so any other
 * account gets no price and Plus hides itself - which read as Plus being
 * gone (Ivan, 2026-11-28: "I dont see plus get plus on another accons").
 * The cure is a row on the server's list, never a switch in the app: a flag
 * the window could set would sell real Plus for a test card.
 *
 * Nothing in a release: there, no price means nothing on sale.
 */
export default function PlusNotOnSale({ plus }: { plus: ISubscriptionState }) {
  const { t } = useTranslation();
  if (
    process.env.NODE_ENV !== 'development' ||
    plus.suspended ||
    plus.plans.length > 0
  ) {
    return null;
  }
  return (
    <p className="plus-not-on-sale" role="note">
      {t('subscription.dev.notOnSale')}
    </p>
  );
}
