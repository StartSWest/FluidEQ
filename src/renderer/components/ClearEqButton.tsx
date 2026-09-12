import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { clearGains } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import useModalKeys from '../utils/useModalKeys';
import MenuIcon from '../icons/MenuIcon';
import '../styles/RestartAudioDialog.scss';

function ClearEqConfirmation({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { refreshState, activeDeviceId } = useFluidEqContext();
  const surface = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const openedDevice = useRef(activeDeviceId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useModalKeys(surface, cancel, { busy, onCancel: onClose });
  useEffect(() => {
    if (activeDeviceId !== openedDevice.current) {
      onClose();
    }
  }, [activeDeviceId, onClose]);
  const confirm = async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await clearGains();
      await refreshState();
      onClose();
    } catch (error) {
      reportError('Could not clear EQ bands', error);
      setFailed(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
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
      <div
        ref={surface}
        className="restart-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-eq-title"
        aria-describedby="clear-eq-body"
        aria-busy={busy}
      >
        <div className="restart-dialog__head">
          <span className="restart-dialog__glyph">
            <MenuIcon name="reset" />
          </span>
          <h2 id="clear-eq-title" className="restart-dialog__title">
            {t('eq.layouts.clearTitle')}
          </h2>
        </div>
        <p id="clear-eq-body" className="restart-dialog__body">
          {t('eq.layouts.clearWarning')}
        </p>
        {failed && (
          <p
            className="restart-dialog__body restart-dialog__body--failed"
            role="alert"
          >
            {t('eq.layouts.error')}
          </p>
        )}
        <div className="restart-dialog__actions">
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
            className="button small"
            disabled={busy}
            onClick={() => confirm()}
          >
            {t('eq.clear')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ClearEqButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button small subtle"
        onClick={() => setOpen(true)}
      >
        <MenuIcon name="reset" className="eq-toolbar__icon" />
        {t('eq.clear')}
      </button>
      {open && <ClearEqConfirmation onClose={() => setOpen(false)} />}
    </>
  );
}
