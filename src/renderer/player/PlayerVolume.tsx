/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { useSystemFader } from '../audio/systemVolume';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';

/**
 * The dock's volume, and it is the computer's — the one fader this app has
 * (`useSystemFader`). Whatever is playing, from whichever source, plays at
 * full level, and this slider is the taskbar's, in the place the hand goes
 * for it. Drawn only once Windows has said what its level is: a slider that
 * moves nothing is worse than none.
 */
const PlayerVolume = () => {
  const { t } = useTranslation();
  const fader = useSystemFader();
  if (fader.level === undefined) {
    return null;
  }
  const { level, isMuted } = fader;
  const name = t('player.volume.system');
  const percent = Math.round(level * 100);

  return (
    <div className="player-volume">
      <button
        type="button"
        className="player-icon-button"
        aria-label={isMuted ? t('library.unmute') : t('library.mute')}
        title={isMuted ? t('library.unmute') : t('library.mute')}
        onClick={fader.toggleMute}
      >
        <PlayerIcon name={isMuted ? 'mute' : 'speaker'} />
      </button>
      <input
        type="range"
        className="player-range player-range--volume"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label={name}
        title={name}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        onChange={(event) => fader.setLevel(Number(event.target.value) / 100)}
      />
      <span className="player-volume__value" aria-hidden="true">
        {percent}
      </span>
    </div>
  );
};

export default PlayerVolume;
