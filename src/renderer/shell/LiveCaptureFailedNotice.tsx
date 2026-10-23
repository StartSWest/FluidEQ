/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { isFluidEngineBuiltIn } from 'common/platformCapabilities';
import { useMacScreenPermission } from '../audio/useMacAudioPermission';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import windowCapabilities from '../utils/windowCapabilities';
import { CaptureFailedNotice } from './ShellNotices';

interface ILiveCaptureFailedNoticeProps {
  onHide: () => void;
  onRetry: () => void;
}

/**
 * The live capture refused on a Mac because FluidEQ may not record the
 * screen: what is missing, by FluidEQ's own name, and the page that changes
 * it. "Try again" has nothing to offer here — macOS gives the same answer
 * until the setting changes — so the setting is the loud button.
 */
const MacCapturePermissionNotice = ({ onHide }: { onHide: () => void }) => {
  const { t } = useTranslation();
  const openPrivacy = () => {
    window.electron.ipcRenderer.openMacAudioPrivacy().catch(() => undefined);
  };
  return (
    <CompactFrame
      className="audio-restart-notice"
      role="status"
      aria-modal={undefined}
      tone="warn"
      icon={<MenuIcon name="alert" />}
      title={t('notice.captureFailed')}
      titleId="capture-failed-title"
      onClose={onHide}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={onHide}
          >
            {t('app.dismiss')}
          </button>
          <button type="button" className="button small" onClick={openPrivacy}>
            {t('engineHealth.openMacPrivacy')}
          </button>
        </>
      }
    >
      <p>{t('notice.captureNeedsMacPermission')}</p>
    </CompactFrame>
  );
};

/**
 * The live capture's failure, with the reason a Mac can name.
 *
 * On a Mac the capture brings a window's picture with the sound, and macOS
 * refuses the picture to an app it has not allowed to record the screen —
 * the upper list under Screen & System Audio Recording; the list for sound
 * alone, which the engine needs, does not cover it. Refused that way, the
 * capture fails with nothing better than "Could not start video source", so
 * the permission is asked for here and, while it is missing, the card says
 * so instead of offering a retry that would be refused again. Coming back to
 * FluidEQ with it allowed starts the capture again by itself.
 *
 * Everywhere else, and on a Mac whose permission is in place, it is the card
 * it always was.
 */
const LiveCaptureFailedNotice = ({
  onHide,
  onRetry,
}: ILiveCaptureFailedNoticeProps) => {
  const isBuiltIn = isFluidEngineBuiltIn(windowCapabilities());
  const screen = useMacScreenPermission();
  const wasRefused = useRef(false);

  useEffect(() => {
    if (screen === undefined) {
      return;
    }
    if (screen !== 'granted') {
      wasRefused.current = true;
      return;
    }
    if (wasRefused.current) {
      wasRefused.current = false;
      onRetry();
    }
  }, [screen, onRetry]);

  if (isBuiltIn && screen === undefined) {
    // Still asking: one card, not the wrong one and then the right one.
    return null;
  }
  if (isBuiltIn && screen !== 'granted') {
    return <MacCapturePermissionNotice onHide={onHide} />;
  }
  return <CaptureFailedNotice onHide={onHide} onRetry={onRetry} />;
};

export default LiveCaptureFailedNotice;
