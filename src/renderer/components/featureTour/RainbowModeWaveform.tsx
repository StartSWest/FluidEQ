/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import { useTheme } from '../../utils/theme';
import oceanWaveformShot from '../../../../assets/tour/rainbow-waveform-ocean.png';
import blackWaveformShot from '../../../../assets/tour/rainbow-waveform-black.png';

export default function RainbowModeWaveform({
  isEnabled,
  onToggle,
}: {
  isEnabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <figure className="tour-slide__art tour-rainbow">
      <span className="tour-slide__kicker">{t('tour.rainbow.waveform')}</span>
      <div className="tour-rainbow__wave">
        <img
          src={theme === 'black' ? blackWaveformShot : oceanWaveformShot}
          alt={t('tour.rainbow.waveform')}
          width={872}
          height={164}
        />
        <button
          type="button"
          className="tour-rainbow__toggle"
          aria-label={t('support.game.euphoriaToggle')}
          aria-pressed={isEnabled}
          onClick={onToggle}
        />
      </div>
      <figcaption>
        <span aria-hidden="true">↑</span>
        {t('tour.rainbow.toggleHint')}
      </figcaption>
    </figure>
  );
}
