/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { forgetSettings } from '../utils/settingsReset';
import useModalKeys from '../utils/useModalKeys';
import CompactFrame from './CompactFrame';
import '../styles/Button.scss';
import '../styles/RestartAudioDialog.scss';

/**
 * "Reset all settings?", asked from the main menu. Main resets the settings
 * it keeps, then the window forgets its own (`settingsReset.ts`) and reloads,
 * which is where every store reads its new install's value again — the one
 * way to be sure that none of them goes on showing the old one.
 *
 * Red, like every confirmation that takes something back to nothing, and it
 * says what stays: the EQ, the outputs and the engine are what somebody is
 * most afraid a reset takes.
 */
const ResetSettingsDialog = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const surface = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useModalKeys(surface, cancel, { busy, onCancel: onClose });

  const confirm = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await window.electron?.ipcRenderer?.resetSettings?.();
    } catch (error) {
      reportError('Could not reset the settings main keeps', error);
      setFailed(true);
      setBusy(false);
      return;
    }
    forgetSettings(window.localStorage);
    window.location.reload();
  };

  return createPortal(
    <div
      className="restart-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <CompactFrame
        ref={surface}
        tone="danger"
        icon={<MenuIcon name="reset" />}
        title={t('settingsReset.title')}
        titleId="settings-reset-title"
        aria-describedby="settings-reset-body settings-reset-kept"
        aria-busy={busy}
        closeLabel={t('config.cancel')}
        onClose={() => {
          if (!busy) {
            onClose();
          }
        }}
        actions={
          <>
            <button
              ref={cancel}
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={onClose}
            >
              {t('config.cancel')}
            </button>
            <button
              type="button"
              className={`button small danger${busy ? ' is-running' : ''}`}
              aria-busy={busy}
              onClick={() => confirm()}
            >
              {t('settingsReset.action')}
            </button>
          </>
        }
      >
        <p id="settings-reset-body">{t('settingsReset.body')}</p>
        <p id="settings-reset-kept">{t('settingsReset.kept')}</p>
        {failed && (
          <p className="settings-reset__failed" role="alert">
            {t('settingsReset.failed')}
          </p>
        )}
      </CompactFrame>
    </div>,
    document.body,
  );
};

export default ResetSettingsDialog;
