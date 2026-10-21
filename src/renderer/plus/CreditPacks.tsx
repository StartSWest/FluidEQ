/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  formatPackPrice,
  type ICreditPack,
  type TBuyFailure,
  type TCheckoutFailure,
  type TStarterFailure,
} from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { creditsText } from './credits';
import { checkoutCreditPack } from './sceneStore';

/** The pack the store suggests: twelve credits, or the middle of what is sold. */
export const suggestedPack = (
  packs: readonly ICreditPack[],
): ICreditPack | undefined =>
  packs.find((pack) => pack.credits === 12) ??
  packs[Math.floor(packs.length / 2)];

const FAILURE_KEYS: Record<
  TBuyFailure | TStarterFailure | TCheckoutFailure,
  TranslationKey
> = {
  offline: 'store.error.offline',
  'signed-out': 'store.error.signedOut',
  unavailable: 'store.error.unavailable',
  server: 'store.error.server',
  unconfirmed: 'store.error.unconfirmed',
  'not-on-sale': 'store.error.notOnSale',
  'terms-outdated': 'store.error.termsOutdated',
  'no-credits': 'store.error.noCredits',
  'already-owned': 'store.error.alreadyOwned',
  'unknown-scene': 'store.error.gone',
  blocked: 'store.error.gone',
  'negative-balance': 'store.error.negative',
  banned: 'store.error.banned',
};

/** What a refused store action says, in the reader's language. */
export const storeFailureKey = (
  reason: TBuyFailure | TStarterFailure | TCheckoutFailure,
): TranslationKey => FAILURE_KEYS[reason];

/**
 * Paying for a pack: Stripe's page opens in the browser, and the credits
 * arrive when the window is come back to (`sceneStore.ts`). `waiting` holds
 * from the page opening until the balance rises above the one paid from —
 * the window cannot tell an abandoned payment from a slow one, and says so —
 * and `arrived` is how many came, once they have.
 */
export const usePackCheckout = (balance: number) => {
  const [opening, setOpening] = useState(false);
  const [paidFrom, setPaidFrom] = useState<number>();
  const [failure, setFailure] = useState<TranslationKey>();
  const arrived =
    paidFrom !== undefined && balance > paidFrom ? balance - paidFrom : 0;
  const waiting = paidFrom !== undefined && arrived === 0;
  const pay = (packId: string) => {
    if (opening) {
      return;
    }
    setOpening(true);
    setFailure(undefined);
    checkoutCreditPack(packId)
      .then((outcome) => {
        setOpening(false);
        if (outcome.ok) {
          setPaidFrom((already) => already ?? balance);
        } else {
          setFailure(storeFailureKey(outcome.reason));
        }
        return undefined;
      })
      .catch(() => {
        setOpening(false);
        setFailure('store.error.offline');
      });
  };
  return { opening, waiting, arrived, failure, pay };
};

interface ICreditPacksProps {
  packs: readonly ICreditPack[];
  selected: string | undefined;
  onSelect: (packId: string) => void;
  disabled: boolean;
  labelledBy: string;
}

/**
 * The packs on sale, one row each: how many scenes it keeps, what one scene
 * comes to, and the price. The report dialog's rows, so a choice in a dialog
 * looks the same everywhere in the app.
 */
export default function CreditPacks({
  packs,
  selected,
  onSelect,
  disabled,
  labelledBy,
}: ICreditPacksProps) {
  const { t, locale } = useTranslation();
  const cheapest = Math.min(
    ...packs.map((pack) => pack.priceCents / pack.credits),
  );
  return (
    <div
      className="dialog-frame__group gallery-report-dialog__reasons store-packs"
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {packs.map((pack) => {
        const id = `store-pack-${pack.id}`;
        const perScene = pack.priceCents / pack.credits;
        return (
          <label
            key={pack.id}
            className="gallery-report-dialog__reason store-pack"
            htmlFor={id}
          >
            <input
              id={id}
              type="radio"
              name="store-pack"
              value={pack.id}
              checked={selected === pack.id}
              disabled={disabled}
              onChange={() => onSelect(pack.id)}
            />
            <span className="gallery-report-dialog__radio" aria-hidden="true" />
            <span className="store-pack__what">
              <span className="store-pack__credits">
                <Glyph name="credit" />
                {creditsText(t, locale, pack.credits)}
              </span>
              <span className="store-pack__each">
                {t('store.pack.each', {
                  price: formatPackPrice(Math.round(perScene), locale),
                })}
                {packs.length > 1 && perScene === cheapest && (
                  <span className="store-pack__best">
                    {t('store.pack.best')}
                  </span>
                )}
              </span>
            </span>
            <span className="store-pack__price">
              {formatPackPrice(pack.priceCents, locale)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
