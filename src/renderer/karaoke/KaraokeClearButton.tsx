/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import '../styles/RestartAudioDialog.scss';

function ClearPlaylistDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const surface = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useModalKeys(surface, cancel, { busy: false, onCancel });

  return createPortal(
    <div
      className="restart-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <CompactFrame
        ref={surface}
        tone="danger"
        icon={<MenuIcon name="clear" />}
        title={t('karaoke.import.clearTitle')}
        titleId="karaoke-clear-title"
        aria-describedby="karaoke-clear-body"
        closeLabel={t('config.cancel')}
        onClose={onCancel}
        actions={
          <>
            <button
              ref={cancel}
              type="button"
              className="button small subtle"
              onClick={onCancel}
            >
              {t('config.cancel')}
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={onConfirm}
            >
              {t('karaoke.import.clear')}
            </button>
          </>
        }
      >
        <p id="karaoke-clear-body">{t('karaoke.import.clearBody')}</p>
      </CompactFrame>
    </div>,
    document.body,
  );
}

export default function KaraokeClearButton({
  onClear,
}: {
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button small subtle karaoke-workspace__action"
        onClick={() => setIsOpen(true)}
      >
        <MenuIcon name="clear" className="karaoke-button__icon" />
        <span>{t('karaoke.import.clear')}</span>
      </button>
      {isOpen && (
        <ClearPlaylistDialog
          onCancel={() => setIsOpen(false)}
          onConfirm={() => {
            setIsOpen(false);
            onClear();
          }}
        />
      )}
    </>
  );
}
