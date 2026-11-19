/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DialogFrame from '../components/DialogFrame';
import Glyph from '../community/Glyph';
import { creditsText, creditsUnit } from '../plus/credits';
import CreditCoin from '../plus/CreditCoin';
import PackPurchase from '../plus/PackPurchase';
import { useSceneStore } from '../plus/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import '../styles/Gallery.scss';

/**
 * Getting credits from the account panel: the packs and nothing else. Paying
 * is the one thing to do here, so the window has one loud button, Pay, and
 * its × to leave (Ivan, 2026-11-19: "make it even more clean for users"): a
 * Done beside Pay was a second way out drawn like a second action.
 */
function CreditsDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useTranslation();
  const ids = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { store } = useSceneStore();
  const close = useCallback(() => onClose(), [onClose]);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: close });
  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="gallery-report-dialog store-dialog store-dialog--credits"
        icon={<Glyph name="credit" />}
        title={t('store.credits.buyTitle')}
        titleId={`${ids}-title`}
        description={<span id={`${ids}-lead`}>{t('store.credits.lead')}</span>}
        // The credit itself, large, on a pool of light in the rail's room
        // under the title, carrying how many the account has, and the count
        // in words under it: a bare figure on a coin could be a price.
        rail={
          <div className="store-dialog__coin">
            <CreditCoin size="l" badge={store?.balance ?? 0} />
            {store && (
              <span className="store-dialog__balance">
                {creditsText(t, locale, store.balance)}
              </span>
            )}
          </div>
        }
        aria-describedby={`${ids}-lead`}
        closeLabel={t('support.close')}
        onClose={close}
        closeRef={closeRef}
      >
        {store && <PackPurchase store={store} />}
      </DialogFrame>
    </div>,
    document.body,
  );
}

/**
 * The account's credits, in the account panel: how many there are, half of
 * one waiting when the account's scenes earned it, and the way to more. How
 * many scenes are the account's is the rail's (`AccountStats`). Shown once
 * the server has said; a store it cannot read yet is left out rather than
 * drawn as zero, which would read as credits gone.
 */
export default function CreditsCard() {
  const { t, locale } = useTranslation();
  const { store } = useSceneStore();
  const [buying, setBuying] = useState(false);
  if (!store) {
    return null;
  }
  const numbers = new Intl.NumberFormat(locale);
  return (
    <section className="credits-card" aria-labelledby="credits-card-title">
      {/* The account's credits as the panel's lead (Ivan, 2026-11-13: "put
          get more credits"): the 3D coin, the balance large beside it, and
          getting more as the loud action. */}
      <div className="credits-card__hero">
        <CreditCoin size="l" />
        <div className="credits-card__figures">
          <span id="credits-card-title" className="plus-card__eyebrow">
            {t('store.credits.title')}
          </span>
          <span className="credits-card__balance">
            <span className="credits-card__count">
              {numbers.format(store.balance)}
            </span>
            {/* The half beside the whole ones, as the figure it adds to; the
                line under says it in words for a screen reader. */}
            {store.halfCredit && (
              <span className="credits-card__fraction" aria-hidden="true">
                ½
              </span>
            )}
            <span className="credits-card__unit">
              {creditsUnit(t, locale, store.balance)}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="button credits-card__more"
          onClick={() => setBuying(true)}
        >
          <Glyph name="credit" />
          {t(
            store.starterClaimed
              ? 'store.credits.buy'
              : 'store.credits.getFree',
          )}
        </button>
      </div>
      {store.halfCredit && (
        <p className="credits-card__half">
          <span className="credits-card__coin" aria-hidden="true" />
          {t('store.credits.half')}
        </p>
      )}
      {/* What a credit is, for somebody who has not got a scene yet. */}
      {store.owned.length === 0 && (
        <p className="plus-card__line">{t('store.credits.what')}</p>
      )}
      {buying && <CreditsDialog onClose={() => setBuying(false)} />}
    </section>
  );
}
