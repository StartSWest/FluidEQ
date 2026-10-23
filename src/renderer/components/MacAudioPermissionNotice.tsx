/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMacAudioPermission } from '../audio/useMacAudioPermission';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import Button from '../widgets/Button';
import CompactFrame from './CompactFrame';
// The engine notice's spot and look: this is the engine saying it cannot work,
// for the one reason a Mac has that Windows does not.
import '../styles/DeviceProfiles.scss';
import '../styles/EngineTroubleNotice.scss';

interface IMacAudioPermissionNoticeProps {
  /** A dialog that has the window's attention; this waits until it is gone. */
  isHidden: boolean;
}

/**
 * macOS has said no to the engine hearing what the Mac plays.
 *
 * The engine then takes nothing (`audio_permission.h`), so the sound plays
 * untouched rather than silenced, and nothing on the page would say why the EQ
 * does nothing: this is where it is said, with the one place that changes it.
 * It goes as soon as macOS says yes — asked again each time FluidEQ comes
 * back to the front, which is how somebody returns from System Settings — and
 * "Not now" puts it away for the session.
 */
const MacAudioPermissionNotice = ({
  isHidden,
}: IMacAudioPermissionNoticeProps) => {
  const { t } = useTranslation();
  const permission = useMacAudioPermission();
  const [isDismissed, setDismissed] = useState(false);
  const wants = permission === 'denied' && !isDismissed && !isHidden;
  // First in the engine's spot: while the engine hears nothing, nothing else
  // it could say is true.
  const isShown = useNoticeTurn('macPermission', wants);

  // Only while it is on screen: an Escape meant for something in front of it
  // must not put this away unseen.
  useEffect(() => {
    if (!isShown) {
      return undefined;
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setDismissed(true);
      }
    };
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [isShown]);

  if (!isShown) {
    return null;
  }

  const dismiss = () => setDismissed(true);
  const openPrivacy = () => {
    window.electron.ipcRenderer.openMacAudioPrivacy().catch(() => undefined);
  };

  return createPortal(
    <CompactFrame
      className="device-apo-notice engine-trouble-notice"
      tone="warn"
      icon={<MenuIcon name="alert" />}
      title={t('engineHealth.macPermissionTitle')}
      titleId="mac-permission-notice-title"
      // A notice over the page, not a dialog in front of it: the window is
      // usable while it stands.
      role="dialog"
      aria-modal="false"
      aria-describedby="mac-permission-notice-body"
      onClose={dismiss}
      closeLabel={t('app.dismiss')}
      actions={
        <>
          <Button
            ariaLabel={t('output.notNow')}
            isDisabled={false}
            className="small subtle"
            handleChange={dismiss}
          >
            {t('output.notNow')}
          </Button>
          <Button
            ariaLabel={t('engineHealth.openMacPrivacy')}
            isDisabled={false}
            className="small"
            handleChange={openPrivacy}
          >
            {t('engineHealth.openMacPrivacy')}
          </Button>
        </>
      }
    >
      <p id="mac-permission-notice-body">
        {t('engineHealth.macPermissionBody')}
      </p>
    </CompactFrame>,
    document.body,
  );
};

export default MacAudioPermissionNotice;
