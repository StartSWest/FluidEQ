/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties } from 'react';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import { useTranslation } from '../utils/I18nContext';
import {
  type IKaraokeLiveValue,
  useKaraokeLiveValue,
} from './karaokeLiveValue';

interface IKaraokeTransportPositionProps {
  /** Ids the line's label is tied to its input by. */
  controlId: string;
  playhead: IKaraokeLiveValue<number>;
  durationMs: number;
  canPlay: boolean;
  onSeek: (positionMs: number) => void;
}

/**
 * The seek line and its two clocks: the only part of the karaoke bar that
 * moves with the song, and so the only part a tick of the playhead renders.
 * Handed the playhead as a number, the whole bar - six keys, their icons and
 * the faders - rendered with every tick, twenty times a second.
 */
const KaraokeTransportPosition = ({
  controlId,
  playhead,
  durationMs,
  canPlay,
  onSeek,
}: IKaraokeTransportPositionProps) => {
  const { t } = useTranslation();
  const playheadMs = useKaraokeLiveValue(playhead);
  const progress =
    durationMs > 0 ? Math.min(100, (playheadMs / durationMs) * 100) : 0;
  const progressStyle = {
    '--karaoke-range-progress': `${progress}%`,
  } as CSSProperties;
  return (
    <div className="karaoke-transport__position">
      <time className="karaoke-transport__time">
        {formatKaraokeTime(playheadMs)}
      </time>
      <label
        className="karaoke-transport__timeline"
        htmlFor={`${controlId}-position`}
      >
        <span className="karaoke-transport__sr-label">
          {t('karaoke.transport.seek')}
        </span>
        <input
          id={`${controlId}-position`}
          type="range"
          min={0}
          max={Math.max(1, durationMs)}
          step={100}
          value={Math.min(playheadMs, Math.max(1, durationMs))}
          style={progressStyle}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={!canPlay || durationMs <= 0}
        />
      </label>
      <time className="karaoke-transport__time">
        -{formatKaraokeTime(Math.max(0, durationMs - playheadMs))}
      </time>
    </div>
  );
};

export default KaraokeTransportPosition;
