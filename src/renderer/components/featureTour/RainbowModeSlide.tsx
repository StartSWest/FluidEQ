/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import {
  setEuphoriaEnabled,
  useIsEuphoriaEnabled,
  winEuphoria,
} from '../../utils/euphoriaMode';
import RainbowModeWaveform from './RainbowModeWaveform';
import '../../styles/Support.scss';

export default function RainbowModeSlide() {
  const { t } = useTranslation();
  const isEnabled = useIsEuphoriaEnabled();
  const toggle = () => {
    // The welcome shortcut unlocks only the look, without claiming a donation
    // or inventing a game score. Both controls share the titlebar preference.
    if (isEnabled) {
      setEuphoriaEnabled(false);
    } else {
      winEuphoria();
    }
  };

  return (
    <div className="tour-slide tour-slide--feature">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t('support.eyebrow')}</span>
        <h3 className="tour-slide__title">{t('tour.rainbow.title')}</h3>
        <p className="tour-slide__lead">{t('tour.rainbow.lead')}</p>
        <div className="tour-slide__how">
          <span className="tour-slide__how-title">{t('tour.howTitle')}</span>
          <p>{t('tour.rainbow.how')}</p>
          <button
            type="button"
            className="button small support-dialog__contributed"
            aria-pressed={isEnabled}
            onClick={toggle}
          >
            {t(isEnabled ? 'tour.rainbow.disable' : 'tour.rainbow.enable')}
          </button>
        </div>
      </div>
      <RainbowModeWaveform isEnabled={isEnabled} onToggle={toggle} />
    </div>
  );
}
