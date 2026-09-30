import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EQ_CUTS } from 'common/eqCuts';
import { useFluidEqLayers, useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import {
  clearGains,
  setEqCut,
  setTone as setToneApi,
} from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import useModalKeys from '../utils/useModalKeys';
import MenuIcon from '../icons/MenuIcon';
import CompactFrame from './CompactFrame';
import '../styles/RestartAudioDialog.scss';

function ClearEqConfirmation({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { refreshState, activeDeviceId } = useFluidEqShell();
  const { eqCuts } = useFluidEqLayers();
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
      // Clear EQ clears what the EQ page sets, and the Tone panel is on it:
      // Bass, Mid and Treble, and the two cuts either side of them (Ivan,
      // 2026-09-29: "when resetting the EQ it reset the tones but not the low
      // cut and high cut"). The EQ chip's × clears the bands alone: the Tone
      // is a layer with a chip of its own (`tone.ts`). A cut is FluidEQ's own
      // setting, written for every output (`eqCuts.ts`), so only one that is
      // on is written, each write reloading every output's engine.
      await clearGains();
      await setToneApi(null);
      await EQ_CUTS.filter((cut) => (eqCuts?.[cut] ?? 0) > 0).reduce(
        (written, cut) => written.then(() => setEqCut(cut, 0)),
        Promise.resolve(),
      );
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
        // Red: it sets every band and the Tone back to nothing, the kind of
        // answer every confirmation in the app now says in red.
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

export default function ClearEqButton() {
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
        <span className="eq-toolbar__word">{t('eq.clear')}</span>
      </button>
      {open && <ClearEqConfirmation onClose={() => setOpen(false)} />}
    </>
  );
}
