/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import DialogFrame from '../components/DialogFrame';
import PlusTermsDocument from '../account/PlusTermsDocument';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';

/**
 * The terms, over the packs: paying for one records an agreement to them
 * (create-credit-checkout), so they are one press away from the button that
 * pays, on top of the dialog rather than in the account panel behind it.
 */
export default function StoreTermsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const ids = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: close });
  return createPortal(
    <div
      className="gallery-dialog-backdrop store-terms-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="store-terms-dialog"
        icon={<MenuIcon name="shield" />}
        eyebrow={t('terms.eyebrow')}
        title={t('terms.title')}
        titleId={`${ids}-title`}
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
              {t('terms.back')}
            </button>
          </div>
        }
      >
        <PlusTermsDocument />
      </DialogFrame>
    </div>,
    document.body,
  );
}
