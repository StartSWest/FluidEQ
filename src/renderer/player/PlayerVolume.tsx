/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useSystemFader } from '../audio/systemVolume';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';

/** The keys that move a range input; any other key is only passing through. */
const VALUE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

/** What the slider is moving, for the display to show while it moves. */
export interface IVolumeAdjust {
  level: number;
}

interface IPlayerVolumeProps {
  /** The level while the slider is held, `undefined` once it is let go. */
  onAdjust: (adjust: IVolumeAdjust | undefined) => void;
}

/**
 * The deck's volume, and it is the computer's — the one fader this app has
 * (`useSystemFader`). Whatever is playing, from whichever source, plays at
 * full level, and this slider is the taskbar's, in the place the hand goes
 * for it. Drawn only once Windows has said what its level is: a slider that
 * moves nothing is worse than none.
 */
const PlayerVolume = ({ onAdjust }: IPlayerVolumeProps) => {
  const { t } = useTranslation();
  const fader = useSystemFader();
  const isHeld = useRef(false);

  if (fader.level === undefined) {
    return null;
  }
  const { level, isMuted } = fader;
  const name = t('player.volume.system');

  const setLevel = (next: number) => {
    fader.setLevel(next);
    if (isHeld.current) {
      onAdjust({ level: next });
    }
  };
  const hold = () => {
    isHeld.current = true;
    onAdjust({ level });
  };
  const letGo = () => {
    if (!isHeld.current) {
      return;
    }
    isHeld.current = false;
    onAdjust(undefined);
  };
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
        onChange={(event) => setLevel(Number(event.target.value) / 100)}
        onPointerDown={hold}
        onPointerUp={letGo}
        onPointerCancel={letGo}
        onKeyDown={(event) => {
          if (VALUE_KEYS.has(event.key)) {
            hold();
          }
        }}
        onKeyUp={(event) => {
          if (VALUE_KEYS.has(event.key)) {
            letGo();
          }
        }}
        onBlur={letGo}
      />
    </div>
  );
};

export default PlayerVolume;
