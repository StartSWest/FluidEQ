/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  formatPackPrice,
  type ICreditPack,
  type TBuyFailure,
  type TCheckoutFailure,
  type TStarterFailure,
} from 'common/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import CoinMedal from './CoinMedal';
import { creditsText } from './credits';
import { checkoutCreditPack, onCheckoutReturned } from './sceneStore';

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
 * arrive by themselves once it lands (`sceneStore.ts`). `waiting` holds
 * from the page opening until the balance rises above the one paid from —
 * the window cannot tell an abandoned payment from a slow one, and says so —
 * and `arrived` is how many came, once they have.
 */
export const usePackCheckout = (balance: number) => {
  const { locale } = useTranslation();
  const [opening, setOpening] = useState(false);
  const [paidFrom, setPaidFrom] = useState<number>();
  const [failure, setFailure] = useState<TranslationKey>();
  const arrived =
    paidFrom !== undefined && balance > paidFrom ? balance - paidFrom : 0;
  const waiting = paidFrom !== undefined && arrived === 0;
  // Cancelled on Stripe's page and back through its return page: nothing is
  // on its way, so the window stops saying it is waiting for it.
  useEffect(
    () =>
      onCheckoutReturned((ended) => {
        if (ended === 'cancelled') {
          setPaidFrom((from) =>
            from !== undefined && balance <= from ? undefined : from,
          );
        }
      }),
    [balance],
  );
  const pay = (packId: string) => {
    if (opening) {
      return;
    }
    setOpening(true);
    setFailure(undefined);
    checkoutCreditPack(packId, locale)
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

/**
 * A pack as a pile of the 3D coin: one coin for the smallest pack, two for
 * the next, three for the biggest (Ivan, 2026-11-13: "show the 3d coins also
 * on each thing to buy so is more attractive to buy a nice coin").
 */
function CoinPile({ coins }: { coins: number }) {
  return (
    <span
      className={`store-pack__pile store-pack__pile--${coins}`}
      aria-hidden="true"
    >
      {Array.from({ length: coins }, (_, index) => (
        // A coin's place in the pile is what it is: the pile never reorders.
        // eslint-disable-next-line react/no-array-index-key -- see above
        <CoinMedal key={index} className="store-pack__coin" />
      ))}
    </span>
  );
}

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
  // Each pack's rank by size: the pile grows with it, three coins at most.
  const sizes = [...new Set(packs.map((pack) => pack.credits))].sort(
    (a, b) => a - b,
  );
  const coinsFor = (credits: number) => Math.min(3, sizes.indexOf(credits) + 1);
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
            <CoinPile coins={coinsFor(pack.credits)} />
            <span className="store-pack__what">
              <span className="store-pack__credits">
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
