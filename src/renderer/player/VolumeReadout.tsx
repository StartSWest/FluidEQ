/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import type { IVolumeAdjust } from './PlayerVolume';

/**
 * What the display shows while the volume slider is held: the computer's
 * level, named as such, with a bar that moves with the hand.
 */
const VolumeReadout = ({ adjust }: { adjust: IVolumeAdjust }) => {
  const { t } = useTranslation();
  const percent = Math.round(adjust.level * 100);
  return (
    <span className="player-volume-readout" role="status">
      <PlayerIcon name="speaker" className="player-icon player-icon--readout" />
      <span className="player-volume-readout__name">
        {t('player.volume.system')}
      </span>
      <span
        className="player-volume-readout__bar"
        style={{ '--level': adjust.level } as CSSProperties}
        aria-hidden="true"
      />
      <span className="player-volume-readout__value">{percent}%</span>
    </span>
  );
};

export default VolumeReadout;
