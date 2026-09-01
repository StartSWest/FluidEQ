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

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ILibraryTrack } from '../../../common/library/types';
import { TLibraryRepeat } from '../../../common/library/queue';
import { useTransportStrip } from '../../audio/useTransportStrip';
import { useMediaQuery } from '../../utils/useMediaQuery';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import MenuIcon from '../../icons/MenuIcon';
import SongEqBadge from '../../components/SongEqBadge';
import LibraryCoverArt from '../LibraryCoverArt';
import '../../styles/NowPlayingBar.scss';

export interface INowPlayingBarProps {
  /**
   * Over the content rather than beside it, in full screen.
   *
   * The strip this bar reserves at the foot of the window is what keeps it
   * from covering the last row of a tab. Full screen has no last row to
   * protect: the picture is meant to reach the edge, and a reserved strip
   * there is a band of background under a stage that should have filled it.
   */
  isFloating?: boolean;
  /**
   * Faded out of the way, while full screen has been still for a moment.
   *
   * Set from the same store the graph's own toolbar reads, so the two go and
   * come back together: two pieces of chrome disagreeing by a few hundred
   * milliseconds is worse than either behaviour on its own.
   */
  isIdle?: boolean;
  track: ILibraryTrack | undefined;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: TLibraryRepeat;
  isShuffled: boolean;
  onToggle: () => void;
  onSkip: (direction: 1 | -1) => void;
  /** Pauses and rewinds the loaded item without discarding it. This bar is
   * mounted above every tab, so the command reaches the same player instance
   * even when its Library view is not visible. */
  onStop: () => void;
  onSeek: (positionMs: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  /** Whether the playing track is in the Favourites playlist. */
  isFavorite?: boolean;
  /** Put the playing track into Favourites, or take it out. Optional, and the
   * star is not drawn without it: this bar renders in tests and in stories
   * with no playlist provider above it, and a star that quietly does nothing
   * is worse than no star. */
  onFavorite?: () => void;
  onVolume: (value: number) => void;
  /**
   * Called when a volume gesture ends, not while it runs.
   *
   * `onVolume` fires on every step of a `0.01` slider and must stay cheap so
   * the sound tracks the pointer; this is where the value is written down.
   */
  onVolumeCommit: () => void;
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
export const formatDuration = (ms: number): string => {
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
const formatSummary = (
  track: ILibraryTrack,
): { codec?: string; measures: string[] } => {
  const measures: string[] = [];
  if (track.bitrate !== undefined && track.bitrate > 0) {
    measures.push(`${Math.round(track.bitrate / 1000)} kbps`);
  }
  if (track.sampleRate !== undefined && track.sampleRate > 0) {
    // One decimal, and no trailing `.0` — 44.1 kHz and 48 kHz both read
    // naturally, `48.0 kHz` does not.
    const khz = track.sampleRate / 1000;
    measures.push(`${Number(khz.toFixed(1))} kHz`);
  }
  // Returned in pieces rather than joined, because the two that say how good
  // the file is get the tint and the codec name does not. Which container a
  // track sits in is trivia; 128 kbps against 320 is the thing worth reading
  // at a glance, and at one uniform muted grey the whole line was equally
  // ignorable.
  return {
    codec: track.codec ? track.codec.toUpperCase() : undefined,
    measures,
  };
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
  | 'favorite'
  | 'favoriteOn'
  | 'volume'
  | 'volumeOff';

/**
 * Compact transport glyphs, sized for a 34px circular button — the same
 * geometry `KaraokeTransportIcon` draws its previous/play/pause/next/volume
 * shapes for, and the path data below for those four is copied from there
 * rather than re-invented. Shuffle and repeat have no existing precedent
 * anywhere in the icon set, so those two are new, drawn in the same
 * stroke-only 24x24 language as the rest.
 */
export const TransportIcon = ({ name }: { name: TTransportIcon }) => {
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
  } else if (name === 'favorite' || name === 'favoriteOn') {
    // The same five-pointed star `MenuIcon.star` draws, on the same 24x24
    // grid and with the same two states the library already uses for a
    // favourite: outline for "not in there", filled for "in there". A second
    // shape here would be a second thing to learn for one meaning.
    const star =
      'M12 4l2.3 4.7 5.2.8-3.75 3.65.9 5.15L12 15.9l-4.65 2.4.9-5.15L4.5 9.5l5.2-.8L12 4z';
    drawing = (
      <path
        className={
          name === 'favoriteOn'
            ? 'now-playing-bar__icon-fill'
            : 'now-playing-bar__icon-stroke'
        }
        d={star}
      />
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
  } else if (name === 'volumeOff') {
    // The same cone, with the arcs struck through rather than removed: a
    // muted fader and a quiet one have to be told apart at a glance, and an
    // icon that merely loses its waves reads as "turned down".
    drawing = (
      <>
        <path
          className="now-playing-bar__icon-fill"
          d="M5 9.4h3.1l4.2-3.2v11.6l-4.2-3.2H5V9.4z"
        />
        <path
          className="now-playing-bar__icon-stroke"
          d="M15.5 9.8l4.4 4.4M19.9 9.8l-4.4 4.4"
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
  isIdle = false,
  isFloating = false,
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
  isFavorite = false,
  onFavorite,
  onVolume,
  onVolumeCommit,
  onReveal,
  volume = 1,
  isUnplayable = false,
}: INowPlayingBarProps) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);

  // Where the fader was before it was muted, so unmuting is not a guess.
  // A ref because it is only ever read on the next press.
  const restoreVolumeRef = useRef(volume > 0 ? volume : 1);
  if (volume > 0) {
    restoreVolumeRef.current = volume;
  }

  // The strip of window this bar occupies, reserved and measured — see
  // `useTransportStrip`, which the other tabs' bar shares.
  useTransportStrip(barRef, Boolean(track), isFloating);

  /**
   * Where the thumb is while it is being dragged, and nothing else.
   *
   * Held rather than sent straight through, because `change` on a range input
   * fires on every pointer move: seeking from each one asked the decoder for
   * a new position dozens of times a second, and the fragment of audio heard
   * repeating is one of those decodes finishing after the next had already
   * been asked for. The five-second buttons ask exactly once and have always
   * been clean — that difference is the whole diagnosis.
   *
   * `undefined` the rest of the time, so the bar follows the element rather
   * than a stale number: the last version of this held the scrub value past
   * the release and fought the position coming back.
   */
  /**
   * True when the window is too narrow for the bar to carry its secondary
   * controls on the surface.
   *
   * Measured rather than styled, because the alternative is rendering both
   * arrangements and hiding one — and two copies of a volume fader is two
   * things a screen reader offers where only one is real. The breakpoint is
   * the shell's own: below it `App.scss` has already dropped to two columns,
   * and the bar's three-column grid has no room left for a slider.
   */
  const isCompact = useMediaQuery('(max-width: 900px)');

  /**
   * Narrower still: no room for a seek line beside the keys.
   *
   * Measured at 700 the line was under the fader next to it. The keys stay on
   * the surface because they are what a bar is for; the line and its clock go
   * behind the button, with everything else that had to leave.
   */
  const isTight = useMediaQuery('(max-width: 700px)');

  /** The button the options menu hangs off, or nothing while it is shut —
   * the same shape `KaraokeTransport` gives its own mix popover. */
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  // Nothing to hang a menu off once the bar stops being compact.
  useEffect(() => {
    if (!isCompact) {
      setOptionsAnchor(null);
    }
  }, [isCompact]);

  const [scrubMs, setScrubMs] = useState<number | undefined>(undefined);
  /** The same value, readable by `commitScrub` without making it depend on
   * the state it is about to clear — a state updater is not the place to seek
   * from, and reading it through a ref keeps that callback pure. */
  const scrubRef = useRef<number | undefined>(undefined);
  const startScrub = useCallback((value: number) => {
    scrubRef.current = value;
    setScrubMs(value);
  }, []);
  const commitScrub = useCallback(() => {
    const value = scrubRef.current;
    if (value === undefined) {
      return;
    }
    // Cleared in the same breath as the seek. `seek` reads the playhead
    // straight back off the element, so the position this bar renders next is
    // already the number the thumb is showing and there is nothing to jump
    // back from.
    scrubRef.current = undefined;
    setScrubMs(undefined);
    onSeek(value);
  }, [onSeek]);

  if (!track) {
    return null;
  }

  /** The three secondary controls, written once and placed in one of two
   * spots — see where this is used. */
  const format = formatSummary(track);
  const clampedPosition = Math.min(positionMs, Math.max(1, durationMs));
  // While a drag is in progress the bar shows where the thumb is, not where
  // the audio still is — the filled track and both clocks with it, or the
  // thumb would slide across a bar that disagreed with it.
  const shownPosition = scrubMs ?? clampedPosition;
  const progressPercent =
    durationMs > 0 ? Math.min(100, (shownPosition / durationMs) * 100) : 0;

  /**
   * The seek line and its two clocks.
   *
   * Named because it is drawn in one of two places and never in both: beside
   * the keys while there is room, and inside the options menu when there is
   * not. Rendered twice and hidden with CSS it would be two sliders a screen
   * reader offers where only one of them is real.
   */
  const positionRow = (
    <div className="now-playing-bar__position">
      <time className="now-playing-bar__time">
        {formatDuration(shownPosition)}
      </time>
      <input
        type="range"
        className="now-playing-bar__seek"
        min={0}
        max={Math.max(1, durationMs)}
        step={100}
        value={shownPosition}
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
        // A drag moves the thumb; only letting go moves the audio.
        //
        // `change` on a range input fires on every pointer move, so
        // seeking from here asked the decoder for a new position dozens
        // of times a second — and each one abandons what it was decoding
        // and re-syncs, which is heard as a fragment of the passage
        // repeating. The five-second buttons never did it because they
        // ask exactly once; that is the whole difference, and it is the
        // reason this is a held value rather than a live one.
        //
        // Cleared in the same breath as the seek: `seek` reads the
        // playhead straight back off the element, so by the time this
        // renders again `positionMs` is already the number the thumb is
        // showing and there is nothing to jump back from.
        onChange={(event) => startScrub(Number(event.target.value))}
        onPointerUp={commitScrub}
        onPointerCancel={commitScrub}
        onKeyUp={commitScrub}
        onBlur={commitScrub}
      />
      <time className="now-playing-bar__time">
        -{formatDuration(Math.max(0, durationMs - shownPosition))}
      </time>
    </div>
  );

  const favoriteLabel = t(
    isFavorite
      ? 'library.playlist.removeFromFavorites'
      : 'library.playlist.addToFavorites',
  );

  const secondaryControls = (
    <>
      {isTight && positionRow}
      {/* First in the group, so the star sits against the clock rather than
          between shuffle and repeat: it is about the track the bar is
          showing, and the two beside it are about the queue. */}
      {onFavorite && (
        <button
          type="button"
          className={`now-playing-bar__toggle now-playing-bar__favorite${
            isFavorite ? ' is-on' : ''
          }`}
          aria-label={favoriteLabel}
          title={favoriteLabel}
          aria-pressed={isFavorite}
          onClick={onFavorite}
        >
          <TransportIcon name={isFavorite ? 'favoriteOn' : 'favorite'} />
          <span className="now-playing-bar__option-label">{favoriteLabel}</span>
        </button>
      )}
      <button
        type="button"
        className="now-playing-bar__toggle"
        aria-label={t('library.shuffle')}
        title={t('library.shuffle')}
        aria-pressed={isShuffled}
        onClick={onShuffle}
      >
        <TransportIcon name="shuffle" />
        {/* Shown only inside the menu, where a row is the width of the panel
            and an icon alone in it reads as a stray dot. Hidden on the bar by
            `NowPlayingBar.scss` rather than rendered twice. */}
        <span className="now-playing-bar__option-label">
          {t('library.shuffle')}
        </span>
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
        <span className="now-playing-bar__option-label">
          {t(REPEAT_LABEL_KEYS[repeat])}
        </span>
      </button>
      <div className="now-playing-bar__volume">
        {/* The icon is the mute switch, the way karaoke's faders are. A fader
            dragged to zero leaves nothing to say where it was; this puts it
            back. */}
        <button
          type="button"
          className="now-playing-bar__volume-icon"
          aria-label={t(volume > 0 ? 'library.mute' : 'library.unmute')}
          title={t(volume > 0 ? 'library.mute' : 'library.unmute')}
          aria-pressed={volume === 0}
          onClick={() => {
            if (volume > 0) {
              restoreVolumeRef.current = volume;
              onVolume(0);
            } else {
              onVolume(restoreVolumeRef.current);
            }
            // A click is a whole gesture on its own, so it commits at once.
            // Only the slider has a middle to stay out of.
            onVolumeCommit();
          }}
        >
          <TransportIcon name={volume > 0 ? 'volume' : 'volumeOff'} />
        </button>
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
          // Written down when the gesture ends, never during it. `onChange`
          // fires on every 0.01 step, and a synchronous localStorage write per
          // step is a hundred of them across one drag — the sound has to
          // follow the pointer, so the saving gets out of its way.
          //
          // Three enders because a range input has three: the pointer (which
          // it captures, so this arrives even if you release outside it), the
          // arrow keys, and losing focus mid-drag to something else.
          onPointerUp={onVolumeCommit}
          onKeyUp={onVolumeCommit}
          onBlur={onVolumeCommit}
        />
        <span className="now-playing-bar__volume-value" aria-hidden="true">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </>
  );

  // Portalled to `document.body`, the same escape `AnchoredMenu` uses and for
  // the same reason: this is fixed to the foot of the *window*, and mounting
  // it deep inside `LibraryPlayerProvider`'s tree — under whichever tab panel
  // happens to be a React ancestor today — must not put it at the mercy of
  // some ancestor acquiring a `transform` and quietly becoming the box it is
  // fixed to instead.
  return createPortal(
    <div
      ref={barRef}
      className={`now-playing-bar${isCompact ? ' is-compact' : ''}${
        isIdle ? ' is-idle' : ''
      }${isFloating ? ' is-floating' : ''}`}
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
            {(format.codec || format.measures.length > 0) && (
              <span className="now-playing-bar__format">
                {format.codec}
                {format.measures.map((measure, index) => (
                  <span key={measure}>
                    {/* The separator stays the quiet colour — it belongs to
                        the line, not to the figure after it. */}
                    {(index > 0 || format.codec) && ' · '}
                    <b className="now-playing-bar__measure">{measure}</b>
                  </span>
                ))}
              </span>
            )}
          </span>
        </button>
        {isUnplayable && (
          <span className="now-playing-bar__unplayable" role="status">
            {t('library.unplayable')}
          </span>
        )}
        <SongEqBadge />
      </div>

      {/* The bar's middle column, and nothing else in it. That is what
          keeps the play button on the same pixel whichever tab is driving
          the bar: the two columns either side of it are equal fractions,
          so the group between them is centred in the window whether the
          tab has five buttons or one. */}
      <div className="now-playing-bar__deck">
        <div className="now-playing-bar__buttons">
          {/* The flanks are equal fixed widths and the play button sits
            between them, which is what keeps it on the window's centre
            line. Six buttons do not divide evenly around a seventh, so
            left to itself the row put play half a button off centre and
            the Media tab, with one button, put it dead centre — and the
            control moved under the pointer on the way between tabs. */}
          <div className="now-playing-bar__flank now-playing-bar__flank--start">
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
          </div>

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

          <div className="now-playing-bar__flank now-playing-bar__flank--end">
            <button
              type="button"
              className="now-playing-bar__control now-playing-bar__nudge"
              aria-label={t('library.forward5')}
              title={t('library.forward5')}
              disabled={durationMs <= 0 || isUnplayable}
              onClick={() =>
                onSeek(Math.min(durationMs, positionMs + NUDGE_MS))
              }
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
            {/* Back among the transport keys, where it was asked for, and it
            costs the row nothing: the flank it sits in is a fixed width
            whether it holds two controls or three. */}
            <button
              type="button"
              className="now-playing-bar__control now-playing-bar__stop"
              aria-label={t('library.stop')}
              title={t('library.stop')}
              onClick={onStop}
              disabled={!isPlaying && positionMs <= 0}
            >
              <TransportIcon name="stop" />
            </button>
          </div>
        </div>

        {!isTight && positionRow}
      </div>

      {/* The third column: the faders, and whatever else the window has
          room for. One item, because the column has to be one column for
          the deck between the two of them to be centred. */}
      <div className="now-playing-bar__aside">
        {/* Shuffle, repeat and the volume fader — on the bar while there is
          room for them, and behind one button when there is not. Never
          duplicated into the document and hidden with CSS: two copies of a
          fader is two things a screen reader offers and only one of them
          real. */}
        {isCompact ? (
          <div className="now-playing-bar__secondary">
            <button
              type="button"
              className="now-playing-bar__toggle"
              aria-label={t('library.playbackOptions')}
              title={t('library.playbackOptions')}
              aria-haspopup="dialog"
              aria-expanded={Boolean(optionsAnchor)}
              onClick={(event) => {
                const trigger = event.currentTarget;
                setOptionsAnchor((current) =>
                  current === trigger ? null : trigger,
                );
              }}
            >
              {/* The cog the rest of the app already uses for "settings",
                rather than a hamburger — this opens three controls, not a
                list of places to go. */}
              <MenuIcon
                name="settings"
                className="now-playing-bar__options-icon"
              />
            </button>
            <AnchoredMenu
              anchor={optionsAnchor}
              isOpen={Boolean(optionsAnchor)}
              className="now-playing-bar__options"
              role="dialog"
              ariaLabel={t('library.playbackOptions')}
            >
              {secondaryControls}
            </AnchoredMenu>
          </div>
        ) : (
          <div className="now-playing-bar__secondary">{secondaryControls}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default NowPlayingBar;
