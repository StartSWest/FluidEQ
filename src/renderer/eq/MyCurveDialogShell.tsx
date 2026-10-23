/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import DialogFrame from '../components/DialogFrame';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
// Opened from the Squiglink panel too, where the list's own sheet may not be.
import '../styles/MyCurves.scss';

/**
 * The frame every My curves dialog stands in: the app's dialog over its
 * scrim, Escape and the backdrop to leave, Tab kept inside, and nothing to
 * leave while `busy` — an export half written is not a state to walk away
 * from.
 */
export default function MyCurveDialogShell({
  icon,
  title,
  description,
  busy = false,
  footer,
  onClose,
  children,
}: {
  icon: MenuIconName;
  title: string;
  description: string;
  busy?: boolean;
  footer: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalKeys(surfaceRef, closeRef, { busy, onCancel: onClose });

  return createPortal(
    <div
      className="my-curve-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="my-curve-dialog"
        icon={<MenuIcon name={icon} />}
        title={title}
        titleId={titleId}
        description={description}
        aria-busy={busy}
        closeLabel={t('myCurves.cancel')}
        closeRef={closeRef}
        onClose={() => {
          if (!busy) {
            onClose();
          }
        }}
        footer={footer}
      >
        {children}
      </DialogFrame>
    </div>,
    document.body,
  );
}
