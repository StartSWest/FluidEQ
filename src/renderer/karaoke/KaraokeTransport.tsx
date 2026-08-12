/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { CSSProperties } from 'react';
import { formatKaraokeTime } from '../../common/karaoke/clock';
import { useTranslation } from '../utils/I18nContext';
import { TKaraokePlaybackStatus } from './useKaraokeSession';
import '../styles/Button.scss';

interface IKaraokeTransportProps {
  status: TKaraokePlaybackStatus;
  playheadMs: number;
  durationMs: number;
  volume: number;
  onTogglePlayback: () => void;
  onRestart: () => void;
  onSeek: (timeMs: number) => void;
  onSeekLyric: (direction: -1 | 1) => void;
  onVolume: (volume: number) => void;
}

type TKaraokeTransportIcon =
  'restart' | 'previous' | 'play' | 'pause' | 'next' | 'volume';

/**
 * Transport glyphs have their own compact geometry. The general MenuIcon is a
 * stroked menu language, while play/skip controls need solid, balanced shapes
 * that remain obvious inside a 34px circular button.
 */
const KaraokeTransportIcon = ({ name }: { name: TKaraokeTransportIcon }) => {
  let drawing = (
    <path
      className="karaoke-transport__icon-stroke"
      d="M19 7.4V3.8m0 0h-3.6M19 3.8l-2.2 2.1A7.8 7.8 0 1 0 19.5 14"
    />
  );
  if (name === 'previous') {
    drawing = (
      <>
        <rect
          className="karaoke-transport__icon-fill"
          x="6"
          y="7"
          width="2.3"
          height="10"
          rx="1"
        />
        <path
          className="karaoke-transport__icon-fill"
          d="M17.5 6.9v10.2L9.4 12l8.1-5.1z"
        />
      </>
    );
  } else if (name === 'play') {
    drawing = (
      <path
        className="karaoke-transport__icon-fill"
        d="M8.6 6.4c0-.8.9-1.2 1.6-.8l7.8 5.6c.6.4.6 1.2 0 1.6l-7.8 5.6c-.7.5-1.6 0-1.6-.8V6.4z"
      />
    );
  } else if (name === 'pause') {
    drawing = (
      <>
        <rect
          className="karaoke-transport__icon-fill"
          x="7.5"
          y="6.5"
          width="3.4"
          height="11"
          rx="1.3"
        />
        <rect
          className="karaoke-transport__icon-fill"
          x="13.1"
          y="6.5"
          width="3.4"
          height="11"
          rx="1.3"
        />
      </>
    );
  } else if (name === 'next') {
    drawing = (
      <>
        <path
          className="karaoke-transport__icon-fill"
          d="M6.5 6.9v10.2l8.1-5.1-8.1-5.1z"
        />
        <rect
          className="karaoke-transport__icon-fill"
          x="15.7"
          y="7"
          width="2.3"
          height="10"
          rx="1"
        />
      </>
    );
  } else if (name === 'volume') {
    drawing = (
      <>
        <path
          className="karaoke-transport__icon-fill"
          d="M5 9.4h3.1l4.2-3.2v11.6l-4.2-3.2H5V9.4z"
        />
        <path
          className="karaoke-transport__icon-stroke"
          d="M15.2 9.1a4.2 4.2 0 0 1 0 5.8M17.8 6.8a7.4 7.4 0 0 1 0 10.4"
        />
      </>
    );
  }
  return (
    <svg
      className="karaoke-button__icon karaoke-transport__icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
};

const KaraokeTransport = ({
  status,
  playheadMs,
  durationMs,
  volume,
  onTogglePlayback,
  onRestart,
  onSeek,
  onSeekLyric,
  onVolume,
}: IKaraokeTransportProps) => {
  const { t } = useTranslation();
  const isPlaying = status === 'playing';
  const canPlay = !['empty', 'loading'].includes(status);
  const progress =
    durationMs > 0 ? Math.min(100, (playheadMs / durationMs) * 100) : 0;
  const volumePercent = Math.round(volume * 100);
  const progressStyle = {
    '--karaoke-range-progress': `${progress}%`,
  } as CSSProperties;
  const volumeStyle = {
    '--karaoke-range-progress': `${volumePercent}%`,
  } as CSSProperties;
  return (
    <div
      className="karaoke-transport"
      role="group"
      aria-label={t('karaoke.transport.title')}
    >
      <div className="karaoke-transport__buttons">
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={onRestart}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.transport.restart')}
          title={t('karaoke.transport.restart')}
        >
          <KaraokeTransportIcon name="restart" />
        </button>
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={() => onSeekLyric(-1)}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.lyrics.previous')}
          title={t('karaoke.lyrics.previous')}
        >
          <KaraokeTransportIcon name="previous" />
        </button>
        <button
          type="button"
          className={`button small karaoke-transport__control karaoke-transport__play${
            isPlaying ? ' is-playing' : ''
          }`}
          onClick={onTogglePlayback}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t(
            isPlaying ? 'karaoke.transport.pause' : 'karaoke.transport.play',
          )}
          aria-pressed={isPlaying}
        >
          <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          className="button small subtle karaoke-transport__control"
          onClick={() => onSeekLyric(1)}
          disabled={!canPlay}
          aria-disabled={!canPlay}
          aria-label={t('karaoke.lyrics.next')}
          title={t('karaoke.lyrics.next')}
        >
          <KaraokeTransportIcon name="next" />
        </button>
      </div>

      <div className="karaoke-transport__position">
        <time className="karaoke-transport__time">
          {formatKaraokeTime(playheadMs)}
        </time>
        <label
          className="karaoke-transport__timeline"
          htmlFor="karaoke-song-position"
        >
          <span className="karaoke-transport__sr-label">
            {t('karaoke.transport.seek')}
          </span>
          <input
            id="karaoke-song-position"
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
      <label
        className="karaoke-transport__volume"
        htmlFor="karaoke-song-volume"
      >
        <span className="karaoke-transport__volume-icon" aria-hidden="true">
          <KaraokeTransportIcon name="volume" />
        </span>
        <span className="karaoke-transport__sr-label">
          {t('karaoke.transport.volume')}
        </span>
        <input
          id="karaoke-song-volume"
          aria-label={t('karaoke.transport.volume')}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={volumeStyle}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
        <span className="karaoke-transport__volume-value" aria-hidden="true">
          {volumePercent}%
        </span>
      </label>
    </div>
  );
};

export default KaraokeTransport;
