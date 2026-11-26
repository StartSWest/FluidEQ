import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { clearGains } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import useModalKeys from '../utils/useModalKeys';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import '../styles/RestartAudioDialog.scss';

function ClearEqConfirmation({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { refreshState, activeDeviceId } = useFluidEqShell();
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
      // The bands alone (Ivan, 2026-11-26: "Clear EQ cannot reset the tone,
      // for that we have Reset Tone"). The Tone tab — Bass, Mid, Treble and
      // the two cuts either side of them — is a layer of its own with its own
      // reset (`resetToneTab`) and its own chip; it used to be cleared here
      // too, from 2026-09-29.
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
      <CompactFrame
        ref={surface}
        // Red: it sets every band back to nothing, the kind of answer every
        // confirmation in the app now says in red.
        tone="danger"
        icon={<MenuIcon name="reset" />}
        title={t('eq.layouts.clearTitle')}
        titleId="clear-eq-title"
        aria-describedby="clear-eq-body"
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
              className="button small danger"
              disabled={busy}
              onClick={() => confirm()}
            >
              {t('eq.clear')}
            </button>
          </>
        }
      >
        <p id="clear-eq-body">{t('eq.layouts.clearWarning')}</p>
        {failed && (
          <p className="clear-eq__failed" role="alert">
            {t('eq.layouts.error')}
          </p>
        )}
      </CompactFrame>
    </div>,
    document.body,
  );
}

/**
 * Clear EQ, and its confirmation. `label` is the word beside the glyph: the
 * full "Clear EQ" where it stands alone, a shorter one under the EQ page's
 * BANDS caption, which already says what it clears. The tooltip is always
 * the full name.
 */
export default function ClearEqButton({ label }: { label?: string } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button small subtle clear-eq-trigger"
        title={t('eq.clear')}
        onClick={() => setOpen(true)}
      >
        <MenuIcon name="reset" className="eq-toolbar__icon" />
        {/* Hidden, never removed, where the toolbar stands in the EQ page's
          head: the glyph is the button there and the word still names it. */}
        <span className="eq-toolbar__word">{label ?? t('eq.clear')}</span>
      </button>
      {open && <ClearEqConfirmation onClose={() => setOpen(false)} />}
    </>
  );
}
