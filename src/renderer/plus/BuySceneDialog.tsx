/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { SCENE_PRICE_CREDITS } from 'common/sceneStore';
import DialogFrame from '../components/DialogFrame';
import Glyph from '../community/Glyph';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import { storeFailureKey } from './CreditPacks';
import { creditsText } from './credits';
import { ScenePicture } from './GalleryParts';
import PackPurchase from './PackPurchase';
import { buyScene, useSceneStore } from './sceneStore';
import '../styles/Gallery.scss';

interface IBuySceneDialogProps {
  scene: Pick<
    IGalleryScene,
    'lookId' | 'authorId' | 'sceneId' | 'version' | 'updatedAt'
  >;
  name: string;
  /** `bought` once the scene is this account's. */
  onClose: (bought: boolean) => void;
}

/**
 * Keeping a scene for good, for one credit (Ivan, 2026-10-18: "si hay
 * crédito: ¿seguro? no se puede deshacer, se gastará el crédito; si no hay
 * crédito que compren ahí mismo").
 *
 * With a credit it asks once, says plainly that the credit is spent for good,
 * and spends it only on the loud button. Without one it offers the packs
 * right here — the free starter credits first while they are there — and
 * pays in the browser; the dialog stays open meanwhile, and the moment the
 * credits arrive it is the question again, on the same scene.
 */
export default function BuySceneDialog({
  scene,
  name,
  onClose,
}: IBuySceneDialogProps) {
  const { t, locale } = useTranslation();
  const ids = useId();
  const titleId = `${ids}-title`;
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Cancel first: the way out of something that cannot be undone is where
  // Enter lands until somebody chooses otherwise.
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { store, loading, error } = useSceneStore();
  const [buying, setBuying] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();
  const cancel = useCallback(() => onClose(false), [onClose]);
  useModalKeys(surfaceRef, cancelRef, { busy: buying, onCancel: cancel });

  const balance = store?.balance ?? 0;
  const canBuy = store !== undefined && balance >= SCENE_PRICE_CREDITS;

  const confirm = () => {
    if (buying) {
      return;
    }
    setBuying(true);
    setFailure(undefined);
    buyScene(scene.authorId, scene.sceneId)
      .then((outcome) => {
        setBuying(false);
        if (outcome.ok || outcome.reason === 'already-owned') {
          onClose(true);
        } else if (outcome.reason !== 'no-credits') {
          // Without credits the store already says so, and shows the packs.
          setFailure(storeFailureKey(outcome.reason));
        }
        return undefined;
      })
      .catch(() => {
        setBuying(false);
        setFailure('store.error.offline');
      });
  };

  let title = t('store.buy.title', { name });
  let lead = t('store.buy.lead');
  let body;
  if (!store) {
    lead = t('store.loading');
    body = (
      <p className="store-status" role="status">
        {loading && (
          <span className="store-status__spinner" aria-hidden="true" />
        )}
        {loading ? t('store.loading') : t(storeFailureKey(error ?? 'server'))}
      </p>
    );
  } else if (canBuy) {
    body = (
      <>
        <div className="dialog-frame__group store-receipt">
          <ScenePicture scene={scene} className="store-receipt__picture" />
          <span className="store-receipt__what">
            <span className="store-receipt__top">
              <span className="store-receipt__name">{name}</span>
              <span className="store-receipt__price">
                <Glyph name="credit" />
                {creditsText(t, locale, SCENE_PRICE_CREDITS)}
              </span>
            </span>
            <span className="store-receipt__keep">{t('store.buy.keep')}</span>
          </span>
        </div>
        <p className="store-balance">
          {t('store.buy.balance', {
            credits: creditsText(t, locale, balance),
            after: creditsText(t, locale, balance - SCENE_PRICE_CREDITS),
          })}
        </p>
        <p className="store-final">
          <Glyph name="alert" />
          {t('store.buy.final')}
        </p>
        {failure && (
          <p className="gallery-dialog__error" role="alert">
            {t(failure)}
          </p>
        )}
      </>
    );
  } else {
    title = t('store.packs.title');
    lead = t('store.packs.lead', { name });
    body = <PackPurchase store={store} />;
  }

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !buying) {
          cancel();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="gallery-report-dialog store-dialog"
        icon={<MenuIcon name="credit" />}
        title={title}
        titleId={titleId}
        description={<span id={`${ids}-lead`}>{lead}</span>}
        aria-describedby={`${ids}-lead`}
        aria-busy={buying}
        closeLabel={t('support.close')}
        onClose={buying ? undefined : cancel}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={cancelRef}
              type="button"
              className="button small subtle"
              disabled={buying}
              onClick={cancel}
            >
              {t('store.cancel')}
            </button>
            {canBuy && (
              <button
                type="button"
                className={`button small${buying ? ' is-running' : ''}`}
                aria-busy={buying}
                disabled={buying}
                onClick={confirm}
              >
                {buying
                  ? t('store.buy.buying')
                  : t('store.buy.use', {
                      credits: creditsText(t, locale, SCENE_PRICE_CREDITS),
                    })}
              </button>
            )}
          </div>
        }
      >
        {body}
      </DialogFrame>
    </div>,
    document.body,
  );
}
