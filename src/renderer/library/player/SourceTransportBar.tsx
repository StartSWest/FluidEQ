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

import { CSSProperties, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ITransportSource } from '../../audio/transportSource';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/NowPlayingBar.scss';

/**
 * The bar, driven by a tab that is not the library.
 *
 * Deliberately the same card, the same buttons and the same stylesheet as
 * `NowPlayingBar` — this is one transport with two things behind it, not two
 * transports. What it does not have is everything that belongs to a *queue*:
 * no skip, no shuffle, no repeat, no cover art, because a karaoke session is
 * one song and a web page is one page, and offering "next" for either would
 * be offering something nothing can answer.
 *
 * The seek bar and the fader each appear only when the source says it has one.
 * A page we can ask to play or pause has no playhead we can move, and putting
 * a dead slider on the bar would say otherwise.
 */
const SourceTransportBar = ({ source }: { source: ITransportSource }) => {
  const { t } = useTranslation();
  const [scrubMs, setScrubMs] = useState<number | undefined>(undefined);

  const commitScrub = useCallback(
    (value: number) => {
      setScrubMs(undefined);
      source.seek?.(value);
    },
    [source],
  );

  const shownPosition =
    scrubMs ?? Math.min(source.positionMs, source.durationMs);
  const progressPercent =
    source.durationMs > 0
      ? Math.min(100, (shownPosition / source.durationMs) * 100)
      : 0;
  const canSeek = Boolean(source.seek) && source.durationMs > 0;

  return createPortal(
    <div
      className="now-playing-bar is-compact"
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        <span className="now-playing-bar__meta">
          <span className="now-playing-bar__title">{source.title}</span>
          {source.subtitle && (
            <span className="now-playing-bar__artist">{source.subtitle}</span>
          )}
        </span>
      </div>

      <div className="now-playing-bar__transport">
        <div className="now-playing-bar__buttons">
          <button
            type="button"
            className={`now-playing-bar__control now-playing-bar__play${
              source.isPlaying ? ' is-playing' : ''
            }`}
            aria-label={
              source.isPlaying ? t('library.pause') : t('library.play')
            }
            title={source.isPlaying ? t('library.pause') : t('library.play')}
            onClick={source.toggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {source.isPlaying ? (
                <>
                  <rect
                    className="now-playing-bar__icon-fill"
                    x="7.5"
                    y="6.5"
                    width="3.4"
                    height="11"
                    rx="1.3"
                  />
                  <rect
                    className="now-playing-bar__icon-fill"
                    x="13.1"
                    y="6.5"
                    width="3.4"
                    height="11"
                    rx="1.3"
                  />
                </>
              ) : (
                <path
                  className="now-playing-bar__icon-fill"
                  d="M8.6 6.4c0-.8.9-1.2 1.6-.8l7.8 5.6c.6.4.6 1.2 0 1.6l-7.8 5.6c-.7.5-1.6 0-1.6-.8V6.4z"
                />
              )}
            </svg>
          </button>
        </div>
        {canSeek && (
          <div className="now-playing-bar__scrubber">
            <input
              type="range"
              className="now-playing-bar__seek"
              min={0}
              max={Math.max(1, source.durationMs)}
              step={100}
              value={shownPosition}
              style={
                {
                  '--now-playing-progress': `${progressPercent}%`,
                } as CSSProperties
              }
              aria-label={t('library.position')}
              // Held through the drag and sent once on release, for the reason
              // `NowPlayingBar` holds its own: `change` fires on every pointer
              // move, and asking a decoder for a new position dozens of times
              // a second is heard as a fragment repeating.
              onChange={(event) => setScrubMs(Number(event.target.value))}
              onPointerUp={() => scrubMs !== undefined && commitScrub(scrubMs)}
              onKeyUp={() => scrubMs !== undefined && commitScrub(scrubMs)}
              onBlur={() => scrubMs !== undefined && commitScrub(scrubMs)}
            />
          </div>
        )}
      </div>

      <div className="now-playing-bar__secondary">
        {source.setVolume !== undefined && (
          <div className="now-playing-bar__volume">
            <span className="now-playing-bar__volume-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  className="now-playing-bar__icon-fill"
                  d="M5 9.5h3.1L12.5 6v12L8.1 14.5H5z"
                />
              </svg>
            </span>
            <input
              type="range"
              className="now-playing-bar__volume-slider"
              min={0}
              max={1}
              step={0.01}
              value={source.volume ?? 1}
              style={
                {
                  '--now-playing-progress': `${(source.volume ?? 1) * 100}%`,
                } as CSSProperties
              }
              aria-label={t('library.volume')}
              onChange={(event) =>
                source.setVolume?.(Number(event.target.value))
              }
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SourceTransportBar;
