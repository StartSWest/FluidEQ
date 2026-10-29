/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { isFluidEngineBuiltIn } from 'common/platformCapabilities';
import { useMacAudioPermission } from '../audio/useMacAudioPermission';
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
 * system audio: what is missing, by FluidEQ's own name, and the page that changes
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
 * A Mac captures only system audio, like its EQ engine. A refused audio tap
 * can arrive as an ended track, so read the actual audio permission rather
 * than infer it from the media request's error. The Screen Recording list
 * is not relevant. Returning after allowing audio retries the capture.
 *
 * Everywhere else, and on a Mac whose permission is in place, it is the card
 * it always was.
 */
const LiveCaptureFailedNotice = ({
  onHide,
  onRetry,
}: ILiveCaptureFailedNoticeProps) => {
  const isBuiltIn = isFluidEngineBuiltIn(windowCapabilities());
  const audio = useMacAudioPermission();
  const wasRefused = useRef(false);

  useEffect(() => {
    if (audio === undefined) {
      return;
    }
    if (audio === 'denied') {
      wasRefused.current = true;
      return;
    }
    if (audio === 'granted' && wasRefused.current) {
      wasRefused.current = false;
      onRetry();
    }
  }, [audio, onRetry]);

  if (isBuiltIn && audio === undefined) {
    // Still asking: one card, not the wrong one and then the right one.
    return null;
  }
  if (isBuiltIn && audio === 'denied') {
    return <MacCapturePermissionNotice onHide={onHide} />;
  }
  return <CaptureFailedNotice onHide={onHide} onRetry={onRetry} />;
};

export default LiveCaptureFailedNotice;
