/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import PlusMark from './PlusMark';
import {
  plusOnSale,
  plusShown,
  usePlusSubscription,
} from './plusSubscriptionStore';

interface IPlusRailRowProps {
  isActive: boolean;
  onOpen: () => void;
}

/**
 * Plus's place in the Scenes rail, under the gallery: the only way into Plus
 * anywhere in the app (Ivan, 2026-11-28: "no plus elsewere in the app"). Its
 * end says where the account stands - Get Plus in the accent while it can
 * have it, Member, quiet, once it does - so the row is the offer and the
 * member's own page at once. No row at all while Plus is nowhere to be had.
 */
export default function PlusRailRow({ isActive, onOpen }: IPlusRailRowProps) {
  const { t } = useTranslation();
  const plus = usePlusSubscription();
  if (!plus || !plusShown(plus)) {
    return null;
  }
  let state: string | undefined;
  if (plus.subscribed) {
    state = t('subscription.rail.member');
  } else if (plusOnSale(plus)) {
    state = t('subscription.rail.get');
  }
  return (
    <button
      type="button"
      className={`community__channel plus-rail-row${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      title={t('subscription.rail.blurb')}
      onClick={onOpen}
    >
      <span className="community__channel-mark plus-rail-row__mark">
        <PlusMark />
      </span>
      <span className="community__channel-text studio-rail__word">
        <span className="community__channel-name">
          {t('subscription.name')}
        </span>
        <span className="community__channel-blurb">
          {t('subscription.rail.blurb')}
        </span>
      </span>
      {state && (
        <span
          className={`plus-rail-row__state studio-rail__word${
            plus.subscribed ? ' is-member' : ''
          }`}
        >
          {state}
        </span>
      )}
    </button>
  );
}
