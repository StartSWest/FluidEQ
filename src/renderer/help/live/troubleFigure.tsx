/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import Button from '../../widgets/Button';
import '../../styles/DeviceProfiles.scss';
import '../../styles/EngineTroubleNotice.scss';

/**
 * The engine's trouble notice, for the trouble chapter
 * (`helpChapters/listen.ts`): the FluidEQ Engine not running on the
 * headphones being listened to, with Not now, Use Equalizer APO… and Restart
 * Windows audio, as it stands in the notices' stack at the window's bottom
 * right.
 *
 * `EngineTroubleNotice`'s `CompactFrame`, markup class for class: the real
 * notice reads the reader's engine, portals into the window's notice dock and
 * leaves a copy of itself behind when it goes. The buttons are the app's own.
 */

const nothing = () => undefined;

/** The width the notices' stack gives a notice. */
const NOTICE_WIDTH = 460;

export default function TroubleDrawing() {
  const { t } = useTranslation();
  return (
    <div style={{ width: NOTICE_WIDTH + 16, padding: 8 }}>
      <div
        className="compact-frame device-apo-notice engine-trouble-notice"
        role="dialog"
        aria-labelledby="help-trouble-title"
      >
        <div className="compact-frame__strip">
          <span className="dialog-frame__tile is-warn" aria-hidden="true">
            <MenuIcon name="alert" />
          </span>
        </div>
        <div className="compact-frame__main">
          <h2 id="help-trouble-title" className="compact-frame__title">
            {t('engineHealth.offTitle', {
              device: t('help.profiles.sampleHeadset'),
            })}
          </h2>
          <div className="compact-frame__message">
            <p>{t('engineHealth.offBody')}</p>
          </div>
          <div className="compact-frame__actions">
            <Button
              ariaLabel={t('output.notNow')}
              isDisabled={false}
              className="small subtle"
              handleChange={nothing}
            >
              {t('output.notNow')}
            </Button>
            <Button
              ariaLabel={t('engineHealth.useApo')}
              isDisabled={false}
              className="small subtle"
              handleChange={nothing}
            >
              {t('engineHealth.useApo')}
            </Button>
            <Button
              ariaLabel={t('app.menu.restartAudio')}
              isDisabled={false}
              className="small"
              handleChange={nothing}
            >
              {t('app.menu.restartAudio')}
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label={t('app.dismiss')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
