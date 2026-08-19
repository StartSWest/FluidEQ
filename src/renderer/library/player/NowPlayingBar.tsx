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

import { CSSProperties, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ILibraryTrack } from '../../../common/library/types';
import { TLibraryRepeat } from '../../../common/library/queue';
import { useTranslation } from '../../utils/I18nContext';
import LibraryCoverArt from '../LibraryCoverArt';
import '../../styles/NowPlayingBar.scss';

export interface INowPlayingBarProps {
  track: ILibraryTrack | undefined;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: TLibraryRepeat;
  isShuffled: boolean;
  onToggle: () => void;
  onSkip: (direction: 1 | -1) => void;
  onSeek: (positionMs: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (value: number) => void;
  /** Real usage always supplies the live level; the bar's own tests never
   * need a working slider to exercise the behaviours they cover, so this
   * stays optional rather than forcing every caller to thread it through. */
  volume?: number;
  /** True for a format Chromium has no demuxer for — see `isLibraryPlayable`
   * and `LibraryPlayerContext`'s `isUnplayable`. */
  isUnplayable?: boolean;
}

/** `m:ss`, and blank rather than `NaN:NaN` for anything that is not a real,
 * non-negative duration — the same rule `LibraryListView`'s own formatter
 * applies to a track's tagged length. */
const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const REPEAT_LABEL_KEYS = {
  off: 'library.repeat.off',
  all: 'library.repeat.all',
  one: 'library.repeat.one',
} as const;

type TTransportIcon =
  'previous' | 'play' | 'pause' | 'next' | 'shuffle' | 'repeat' | 'volume';

/**
 * Compact transport glyphs, sized for a 34px circular button — the same
 * geometry `KaraokeTransportIcon` draws its previous/play/pause/next/volume
 * shapes for, and the path data below for those four is copied from there
 * rather than re-invented. Shuffle and repeat have no existing precedent
 * anywhere in the icon set, so those two are new, drawn in the same
 * stroke-only 24x24 language as the rest.
 */
const TransportIcon = ({ name }: { name: TTransportIcon }) => {
  let drawing = null;
  if (name === 'previous') {
    drawing = (
      <>
        <rect
          className="now-playing-bar__icon-fill"
          x="6"
          y="7"
          width="2.3"
          height="10"
          rx="1"
        />
        <path
          className="now-playing-bar__icon-fill"
          d="M17.5 6.9v10.2L9.4 12l8.1-5.1z"
        />
      </>
    );
  } else if (name === 'play') {
    drawing = (
      <path
        className="now-playing-bar__icon-fill"
        d="M8.6 6.4c0-.8.9-1.2 1.6-.8l7.8 5.6c.6.4.6 1.2 0 1.6l-7.8 5.6c-.7.5-1.6 0-1.6-.8V6.4z"
      />
    );
  } else if (name === 'pause') {
    drawing = (
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
    );
  } else if (name === 'next') {
    drawing = (
      <>
        <path
          className="now-playing-bar__icon-fill"
          d="M6.5 6.9v10.2l8.1-5.1-8.1-5.1z"
        />
        <rect
          className="now-playing-bar__icon-fill"
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
          className="now-playing-bar__icon-fill"
          d="M5 9.4h3.1l4.2-3.2v11.6l-4.2-3.2H5V9.4z"
        />
        <path
          className="now-playing-bar__icon-stroke"
          d="M15.2 9.1a4.2 4.2 0 0 1 0 5.8M17.8 6.8a7.4 7.4 0 0 1 0 10.4"
        />
      </>
    );
  } else if (name === 'shuffle') {
    drawing = (
      <>
        <path
          className="now-playing-bar__icon-stroke"
          d="M4 7.5h3.4L15 16.5h4.4M4 16.5h3.4L11 12"
        />
        <path
          className="now-playing-bar__icon-fill"
          d="M17.6 5.1l3 2.4-3 2.4V5.1zM17.6 14.1l3 2.4-3 2.4v-4.8z"
        />
      </>
    );
  } else {
    // repeat
    drawing = (
      <>
        <path
          className="now-playing-bar__icon-stroke"
          d="M5 9.6a4.6 4.6 0 0 1 4.6-4.6h7M18.2 6.4v5M19 14.4a4.6 4.6 0 0 1-4.6 4.6h-7M5.8 17.6v-5"
        />
        <path
          className="now-playing-bar__icon-fill"
          d="M13.8 3.3l3.4 1.7-3.4 1.7V3.3zM10.2 20.7l-3.4-1.7 3.4-1.7v3.4z"
        />
      </>
    );
  }
  return (
    <svg
      className="now-playing-bar__icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
};

/**
 * The bar that stays on screen wherever you go in the app, for as long as
 * something is loaded. Returns `null` the rest of the time — a permanent
 * empty strip across every tab is a worse tax than the bar is a benefit.
 *
 * A pure, controlled view: every value it draws and every action it can ask
 * for arrives as a prop. `LibraryPlayerContext` is the one caller that wires
 * it to something real; keeping the split lets this render (and this test
 * file) without a provider at all.
 */
const NowPlayingBar = ({
  track,
  isPlaying,
  positionMs,
  durationMs,
  repeat,
  isShuffled,
  onToggle,
  onSkip,
  onSeek,
  onShuffle,
  onRepeat,
  onVolume,
  volume = 1,
  isUnplayable = false,
}: INowPlayingBarProps) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);

  // A reserved strip at the foot of the window, only while there is
  // something to reserve it for — mirrors the `.minimized` toggle `App.tsx`
  // already applies to `#root` for the response graph, so `App.scss` can
  // give the workspace real breathing room instead of the bar sitting over
  // whatever was already at the bottom of the screen.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle('has-now-playing', Boolean(track));
    return () => root?.classList.remove('has-now-playing');
  }, [track]);

  // The exact strip the bar occupies, published as a CSS variable rather
  // than a guessed pixel figure baked into `App.scss` — the same `--editor-
  // height` pattern `App.tsx` already uses for the graph divider, so a
  // future change to this bar's own padding or icon size cannot silently
  // drift out of sync with how much room `#root` sets aside for it.
  // `ResizeObserver` is absent in the jsdom this file's own tests run
  // under — see `WaveformVisualizer.tsx` for the same guard — so the effect
  // is simply a no-op there rather than something to mock.
  useEffect(() => {
    const element = barRef.current;
    const root = document.getElementById('root');
    if (!element || !root || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const applyHeight = () => {
      root.style.setProperty(
        '--now-playing-bar-height',
        `${element.offsetHeight}px`,
      );
    };
    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [track]);

  if (!track) {
    return null;
  }

  const clampedPosition = Math.min(positionMs, Math.max(1, durationMs));
  const progressPercent =
    durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  // Portalled to `document.body`, the same escape `AnchoredMenu` uses and for
  // the same reason: this is fixed to the foot of the *window*, and mounting
  // it deep inside `LibraryPlayerProvider`'s tree — under whichever tab panel
  // happens to be a React ancestor today — must not put it at the mercy of
  // some ancestor acquiring a `transform` and quietly becoming the box it is
  // fixed to instead.
  return createPortal(
    <div
      ref={barRef}
      className="now-playing-bar"
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        <LibraryCoverArt artId={track.artId} label={track.title} size="row" />
        <div className="now-playing-bar__meta">
          <span className="now-playing-bar__title">{track.title}</span>
          <span className="now-playing-bar__artist">
            {track.artist ?? t('library.unknownArtist')}
          </span>
        </div>
        {isUnplayable && (
          <span className="now-playing-bar__unplayable" role="status">
            {t('library.unplayable')}
          </span>
        )}
      </div>

      <div className="now-playing-bar__transport">
        <div className="now-playing-bar__buttons">
          <button
            type="button"
            className="now-playing-bar__control"
            aria-label={t('library.previous')}
            title={t('library.previous')}
            onClick={() => onSkip(-1)}
          >
            <TransportIcon name="previous" />
          </button>
          <button
            type="button"
            className={`now-playing-bar__control now-playing-bar__play${
              isPlaying ? ' is-playing' : ''
            }`}
            aria-label={t(isPlaying ? 'library.pause' : 'library.play')}
            title={t(isPlaying ? 'library.pause' : 'library.play')}
            aria-pressed={isPlaying}
            disabled={isUnplayable}
            aria-disabled={isUnplayable}
            onClick={onToggle}
          >
            <TransportIcon name={isPlaying ? 'pause' : 'play'} />
          </button>
          <button
            type="button"
            className="now-playing-bar__control"
            aria-label={t('library.next')}
            title={t('library.next')}
            onClick={() => onSkip(1)}
          >
            <TransportIcon name="next" />
          </button>
        </div>

        <div className="now-playing-bar__position">
          <time className="now-playing-bar__time">
            {formatDuration(positionMs)}
          </time>
          <input
            type="range"
            className="now-playing-bar__seek"
            min={0}
            max={Math.max(1, durationMs)}
            step={100}
            value={clampedPosition}
            style={
              {
                '--now-playing-progress': `${progressPercent}%`,
              } as CSSProperties
            }
            aria-label={t('library.position')}
            disabled={durationMs <= 0}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <time className="now-playing-bar__time">
            -{formatDuration(Math.max(0, durationMs - positionMs))}
          </time>
        </div>
      </div>

      <div className="now-playing-bar__secondary">
        <button
          type="button"
          className="now-playing-bar__toggle"
          aria-label={t('library.shuffle')}
          title={t('library.shuffle')}
          aria-pressed={isShuffled}
          onClick={onShuffle}
        >
          <TransportIcon name="shuffle" />
        </button>
        <button
          type="button"
          className="now-playing-bar__toggle"
          aria-label={t(REPEAT_LABEL_KEYS[repeat])}
          title={t(REPEAT_LABEL_KEYS[repeat])}
          aria-pressed={repeat !== 'off'}
          onClick={onRepeat}
        >
          <TransportIcon name="repeat" />
          {repeat === 'one' && <small>1</small>}
        </button>
        <div className="now-playing-bar__volume">
          <span className="now-playing-bar__volume-icon" aria-hidden="true">
            <TransportIcon name="volume" />
          </span>
          <input
            type="range"
            className="now-playing-bar__volume-slider"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            style={
              {
                '--now-playing-progress': `${volume * 100}%`,
              } as CSSProperties
            }
            aria-label={t('library.volume')}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default NowPlayingBar;
