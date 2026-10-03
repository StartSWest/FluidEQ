/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Switch from '../widgets/Switch';
import { setSongSoundOn, useSongSoundOn } from '../audio/songSoundSession';
import { useTranslation } from '../utils/I18nContext';
import '../styles/ExtraOutputs.scss';

/**
 * Whether songs remember the sound they were played with.
 *
 * Under the profiles, because it is a rule about what plays through them:
 * a remembered song's sound is lent over the profile that is on and handed
 * back at its end. The second output card's rule row is the same shape — a
 * switch and two stacked lines, the sentence allowed to wrap — so it wears
 * that row's classes rather than a copy of them.
 */
const SongSoundSwitch = () => {
  const { t } = useTranslation();
  const isOn = useSongSoundOn();
  return (
    <div className="extra-outputs__rule">
      <Switch
        id="song-sound"
        isOn={isOn}
        isDisabled={false}
        handleToggle={() => setSongSoundOn(!isOn)}
        ariaLabel={t('songSound.switch')}
      />
      <span className="extra-outputs__text">
        <span className="extra-outputs__name">{t('songSound.switch')}</span>
        <span className="extra-outputs__profile">
          {t('songSound.switchHint')}
        </span>
      </span>
    </div>
  );
};

export default SongSoundSwitch;
