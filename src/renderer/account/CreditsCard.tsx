/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DialogFrame from '../components/DialogFrame';
import Glyph from '../community/Glyph';
import MenuIcon from '../icons/MenuIcon';
import { creditsUnit } from '../plus/credits';
import PackPurchase from '../plus/PackPurchase';
import { useSceneStore } from '../plus/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import '../styles/Gallery.scss';

/** Getting credits from the account panel: the packs and nothing else. */
function CreditsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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
        className="gallery-report-dialog store-dialog"
        icon={<MenuIcon name="credit" />}
        title={t('store.credits.buyTitle')}
        titleId={`${ids}-title`}
        description={<span id={`${ids}-lead`}>{t('store.credits.lead')}</span>}
        aria-describedby={`${ids}-lead`}
        closeLabel={t('support.close')}
        onClose={close}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={closeRef}
              type="button"
              className="button small subtle"
              onClick={close}
            >
              {t('store.done')}
            </button>
          </div>
        }
      >
        {store && <PackPurchase store={store} />}
      </DialogFrame>
    </div>,
    document.body,
  );
}

/**
 * The account's credits, in the account panel: how many there are, how many
 * scenes are already the account's, and the way to more. Shown once the
 * server has said; a store it cannot read yet is left out rather than drawn
 * as zero, which would read as credits gone.
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
      <span id="credits-card-title" className="plus-card__eyebrow">
        {t('store.credits.title')}
      </span>
      <div className="credits-card__figures">
        <span className="credits-card__balance">
          <Glyph name="credit" />
          <span className="credits-card__count">
            {numbers.format(store.balance)}
          </span>
          <span className="credits-card__unit">
            {creditsUnit(t, locale, store.balance)}
          </span>
        </span>
        <span className="credits-card__owned">
          {t('store.credits.owned', {
            count: numbers.format(store.owned.length),
          })}
        </span>
      </div>
      {store.halfCredit && (
        <p className="credits-card__half">
          <span className="credits-card__coin" aria-hidden="true" />
          {t('store.credits.half')}
        </p>
      )}
      <p className="plus-card__line">{t('store.credits.what')}</p>
      <div className="credits-card__actions">
        {/* Loud only while there is nothing to spend: with credits left, more
            is not what the panel recommends. */}
        <button
          type="button"
          className={`button small${store.balance > 0 ? ' subtle' : ''}`}
          onClick={() => setBuying(true)}
        >
          {t(
            store.starterClaimed
              ? 'store.credits.buy'
              : 'store.credits.getFree',
          )}
        </button>
      </div>
      {buying && <CreditsDialog onClose={() => setBuying(false)} />}
    </section>
  );
}
