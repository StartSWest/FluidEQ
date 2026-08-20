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
  /** Clears the queue entirely — the one always-visible way out of a video
   * that has taken over the Library tab with nothing queued after it. See
   * `LibraryPlayerContext.stop`'s own comment for why this, and not a
   * close button on the video stage, is the fix: this bar is mounted above
   * every tab, so Stop works from wherever the queue was left, not only
   * from the Library tab itself. */
  onStop: () => void;
  onSeek: (positionMs: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (value: number) => void;
  /** Show the playing track where it lives — switches to the Library tab and
   * opens the album it belongs to. Optional so the bar can be rendered on its
   * own in a test without one. */
  onReveal?: () => void;
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

/**
 * What the file actually is: codec, bitrate, sample rate.
 *
 * Read from the tags the scan already stored rather than measured off the
 * decoder — for a constant-bitrate file the two are the same number, and for
 * a variable one `music-metadata` reports the average, which is the figure
 * every other player shows and the only one that is stable enough to read.
 * An instantaneous per-frame rate would flicker several times a second and
 * tell nobody anything they could act on.
 *
 * Each part is optional and the line is only as long as what is known: a
 * file with no readable header contributes nothing rather than a row of
 * dashes.
 */
const formatSummary = (track: ILibraryTrack): string => {
  const parts: string[] = [];
  if (track.codec) {
    parts.push(track.codec.toUpperCase());
  }
  if (track.bitrate !== undefined && track.bitrate > 0) {
    parts.push(`${Math.round(track.bitrate / 1000)} kbps`);
  }
  if (track.sampleRate !== undefined && track.sampleRate > 0) {
    // One decimal, and no trailing `.0` — 44.1 kHz and 48 kHz both read
    // naturally, `48.0 kHz` does not.
    const khz = track.sampleRate / 1000;
    parts.push(`${Number(khz.toFixed(1))} kHz`);
  }
  return parts.join(' · ');
};

const REPEAT_LABEL_KEYS = {
  off: 'library.repeat.off',
  all: 'library.repeat.all',
  one: 'library.repeat.one',
} as const;

/** How far the two nudge buttons move the playhead. Five seconds is the step
 * every player that has this control uses, and it is short enough that
 * pressing it twice is still faster than aiming at the bar. */
const NUDGE_MS = 5_000;

type TTransportIcon =
  | 'previous'
  | 'play'
  | 'pause'
  | 'next'
  | 'stop'
  | 'shuffle'
  | 'repeat'
  | 'back5'
  | 'forward5'
  | 'volume';

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
  } else if (name === 'stop') {
    drawing = (
      <rect
        className="now-playing-bar__icon-fill"
        x="7"
        y="7"
        width="10"
        height="10"
        rx="1.5"
      />
    );
  } else if (name === 'back5' || name === 'forward5') {
    // A circular arrow with the step written inside it — the shape every
    // player uses for this, and the only one that says how far it goes
    // without a tooltip. Mirrored for the two directions rather than drawn
    // twice, so the pair can never drift apart.
    const back = name === 'back5';
    drawing = (
      <g transform={back ? undefined : 'translate(24 0) scale(-1 1)'}>
        <path
          className="now-playing-bar__icon-stroke"
          d="M4.6 12a7.4 7.4 0 1 0 2.2-5.2"
        />
        <path className="now-playing-bar__icon-fill" d="M3.4 3.9v5h5l-5-5z" />
        <text
          className="now-playing-bar__icon-step"
          x="12"
          y="15.4"
          textAnchor="middle"
          transform={back ? undefined : 'translate(24 0) scale(-1 1)'}
        >
          5
        </text>
      </g>
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
  onStop,
  onSeek,
  onShuffle,
  onRepeat,
  onVolume,
  onReveal,
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

  // `KaraokeTransport`'s own two lines, verbatim in shape. That transport has
  // seeked correctly the whole time this one did not, and the difference was
  // never the slider: `LibraryPlayerContext` now reads the position back off
  // the element after a seek and re-reads it on `seeked`, exactly as
  // `useKaraokeSession` does, so there is nothing here left for a held scrub
  // value to protect against.
  const format = formatSummary(track);
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
        {/* The whole block is the control, not a link buried in the title:
            it is the one thing on this bar that identifies what is playing,
            so it is the obvious thing to press to go and find it. */}
        <button
          type="button"
          className="now-playing-bar__reveal"
          aria-label={`${t('library.reveal')} — ${track.title}`}
          onClick={onReveal}
        >
          <LibraryCoverArt artId={track.artId} label={track.title} size="row" />
          <span className="now-playing-bar__meta">
            <span className="now-playing-bar__title">{track.title}</span>
            <span className="now-playing-bar__artist">
              {track.artist ?? t('library.unknownArtist')}
            </span>
            {format && (
              <span className="now-playing-bar__format">{format}</span>
            )}
          </span>
        </button>
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
          {/* Five seconds either way, between the track skips and Play.
              Clamped at both ends here rather than trusting `seek`: a
              negative position is refused by the element and a position past
              the end ends the track, and neither is what "back five seconds"
              near the start or "forward five" near the finish means. */}
          <button
            type="button"
            className="now-playing-bar__control now-playing-bar__nudge"
            aria-label={t('library.back5')}
            title={t('library.back5')}
            disabled={durationMs <= 0 || isUnplayable}
            onClick={() => onSeek(Math.max(0, positionMs - NUDGE_MS))}
          >
            <TransportIcon name="back5" />
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
            className="now-playing-bar__control now-playing-bar__nudge"
            aria-label={t('library.forward5')}
            title={t('library.forward5')}
            disabled={durationMs <= 0 || isUnplayable}
            onClick={() => onSeek(Math.min(durationMs, positionMs + NUDGE_MS))}
          >
            <TransportIcon name="forward5" />
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
          {/* The one control that always ends the dead end a video with
              nothing queued after it leaves the Library tab in — see
              `LibraryPlayerContext.stop`'s own comment for why this bar, not
              a close button on the video stage, is where that fix lives. */}
          <button
            type="button"
            className="now-playing-bar__control"
            aria-label={t('library.stop')}
            title={t('library.stop')}
            onClick={onStop}
          >
            <TransportIcon name="stop" />
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
            // `durationMs` alone leaves this draggable for an unplayable
            // track: `LibraryPlayerContext` sets it from the tag before it
            // even checks `isPlayable`, so a file with real metadata but no
            // demuxer still reports a real length here. Harmless in itself —
            // `seek()` only ever touches a srcless element — but a live
            // slider next to a disabled Play button and a "cannot play this
            // format" message reads as broken.
            disabled={durationMs <= 0 || isUnplayable}
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
