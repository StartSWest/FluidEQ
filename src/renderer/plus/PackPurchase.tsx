/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { formatPackPrice, type ISceneStore } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import CreditPacks, { suggestedPack, usePackCheckout } from './CreditPacks';
import { creditsText } from './credits';
import StarterCredits from './StarterCredits';
import StoreTermsDialog from './StoreTermsDialog';

/**
 * Getting credits, wherever credits are asked for: the free ones first while
 * they are there, then the packs and the button that pays for one in the
 * browser, and what happens while that page is open. The buy dialog shows it
 * when there is no credit to spend; the account panel's dialog is only this.
 */
export default function PackPurchase({ store }: { store: ISceneStore }) {
  const { t, locale } = useTranslation();
  const ids = useId();
  const checkout = usePackCheckout(store.balance);
  const [chosen, setChosen] = useState<string>();
  const [starterFailure, setStarterFailure] = useState<TranslationKey>();
  const [readingTerms, setReadingTerms] = useState(false);
  const pack =
    store.packs.find((entry) => entry.id === chosen) ??
    suggestedPack(store.packs);
  const starterWaiting = !store.starterClaimed;
  const failure = starterFailure ?? checkout.failure;

  return (
    <>
      {store.balance < 0 && (
        <p className="store-final" role="status">
          <Glyph name="alert" />
          {t('store.packs.negative', {
            credits: creditsText(t, locale, store.balance),
          })}
        </p>
      )}
      {starterWaiting && <StarterCredits onFailure={setStarterFailure} />}
      {store.packs.length === 0 ? (
        <p className="store-status">{t('store.packs.none')}</p>
      ) : (
        <>
          <span id={`${ids}-packs`} className="gallery-dialog__label">
            {t('store.packs.choose')}
          </span>
          <CreditPacks
            packs={store.packs}
            selected={pack?.id}
            onSelect={setChosen}
            disabled={checkout.opening}
            labelledBy={`${ids}-packs`}
          />
          {pack && (
            <div className="store-pay">
              {checkout.waiting && (
                <p className="store-status" role="status">
                  <span className="store-status__spinner" aria-hidden="true" />
                  {t('store.packs.waiting')}
                </p>
              )}
              {checkout.arrived > 0 && (
                <p className="store-status store-status--arrived" role="status">
                  <Glyph name="check" />
                  {t('store.packs.arrived', {
                    credits: creditsText(t, locale, checkout.arrived),
                  })}
                </p>
              )}
              {/* Loud only while paying is the recommendation: not beside
                  the free credits, not while a payment is already open, and
                  not once the credits it was for have come. */}
              <button
                type="button"
                className={`button small${
                  starterWaiting || checkout.waiting || checkout.arrived > 0
                    ? ' subtle'
                    : ''
                }${checkout.opening ? ' is-running' : ''}`}
                aria-busy={checkout.opening}
                disabled={checkout.opening}
                onClick={() => checkout.pay(pack.id)}
              >
                {checkout.waiting
                  ? t('store.packs.again')
                  : t('store.packs.pay', {
                      price: formatPackPrice(pack.priceCents, locale),
                    })}
              </button>
            </div>
          )}
        </>
      )}
      {failure && (
        <p className="gallery-dialog__error" role="alert">
          {t(failure)}
        </p>
      )}
      {/* Paying records an agreement to the terms (create-credit-checkout),
          so they are read from here, over the packs. */}
      <div className="store-fine">
        <p className="gallery-fine">{t('store.packs.fine')}</p>
        <button
          type="button"
          className="store-fine__terms"
          onClick={() => setReadingTerms(true)}
        >
          {t('terms.link')}
        </button>
      </div>
      {readingTerms && (
        <StoreTermsDialog onClose={() => setReadingTerms(false)} />
      )}
    </>
  );
}
