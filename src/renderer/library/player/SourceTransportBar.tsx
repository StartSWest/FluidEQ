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

import { CSSProperties, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ITransportSource } from '../../audio/transportSource';
import { setTransportSlot } from '../../audio/transportSlot';
import { useTransportStrip } from '../../audio/useTransportStrip';
import SongEqBadge from '../../components/SongEqBadge';
import LibraryCoverArt from '../LibraryCoverArt';
import { useTranslation } from '../../utils/I18nContext';
import { TransportIcon, formatDuration } from './NowPlayingBar';
import '../../styles/NowPlayingBar.scss';

/** The same five seconds the library's own nudge buttons move by. */
const NUDGE_MS = 5_000;

/**
 * The bar, driven by a tab that is not the library.
 *
 * The same card, the same grid, the same buttons, the same glyphs and the same
 * stylesheet — deliberately down to importing `TransportIcon` from the library
 * bar rather than drawing its own, because this is one transport with two
 * things behind it and not two transports that look alike. Anything drawn
 * twice would eventually be drawn differently.
 *
 * What it does not have is what belongs to a *queue*: no previous, no next, no
 * shuffle, no repeat. A karaoke session is one song and a web page is one
 * page, and offering "next" for either is offering something nothing can
 * answer.
 *
 * The position row and the fader each appear only where the source says it has
 * one. A page we can ask to play or pause has no playhead we can move, and a
 * slider that does nothing would say otherwise.
 */
const SourceTransportBar = ({
  source,
  isIdle = false,
  isFloating = false,
  onReveal,
}: {
  source: ITransportSource;
  /** Over the content rather than beside it — see `NowPlayingBar`. */
  isFloating?: boolean;
  /** Faded out while full screen has been still — see `NowPlayingBar`. */
  isIdle?: boolean;
  /**
   * Go to the tab this player belongs to, where there is one.
   *
   * Absent for the machine's own sound: that is another program playing, and
   * a press that took you to a tab which does not show it would be worse than
   * a press that does nothing.
   */
  onReveal?: () => void;
}) => {
  const { t } = useTranslation();

  /**
   * The tab's own name, on the line the library spends on the codec.
   *
   * Read from the same catalogue the tab strip reads, so the bar and the tab
   * cannot end up calling the same place two things.
   */
  const contextLabel = (() => {
    if (source.owner === 'karaoke') {
      return t('tabs.karaoke');
    }
    // Not a tab at all: the sound is another program's, and the honest line
    // is what it is rather than the name of a page in this app.
    if (source.owner === 'system') {
      return t('library.systemAudio');
    }
    return t('tabs.media');
  })();

  const [scrubMs, setScrubMs] = useState<number | undefined>(undefined);

  const barRef = useRef<HTMLDivElement | null>(null);

  // Where the fader was before it was muted — see `NowPlayingBar`.
  const restoreVolumeRef = useRef(source.volume || 1);
  if ((source.volume ?? 0) > 0) {
    restoreVolumeRef.current = source.volume ?? 1;
  }

  // The same strip of window the library's bar reserves, reserved the
  // same way — this is the same bar in the same place, on another tab.
  useTransportStrip(barRef, true, isFloating);

  // Two different questions that used to be one.
  //
  // A slider needs to know where the playhead is and how long the thing is;
  // a five-second step needs neither, as long as the source will take a
  // relative move. The Media tab's page and the machine's own players are
  // exactly that case — steppable, unmeasurable — and folding the two
  // questions together is why they had no skip buttons at all.
  const canSeek = Boolean(source.seek) && source.durationMs > 0;
  const canStep = canSeek || Boolean(source.nudge);
  const shownPosition =
    scrubMs ?? Math.min(source.positionMs, Math.max(1, source.durationMs));
  const progressPercent =
    source.durationMs > 0
      ? Math.min(100, (shownPosition / source.durationMs) * 100)
      : 0;

  // Held through the drag and sent once on release, for the reason
  // `NowPlayingBar` holds its own: `change` fires on every pointer move, and
  // asking a decoder for a new position dozens of times a second is heard as
  // a fragment of the audio repeating.
  const commitScrub = useCallback(() => {
    setScrubMs((current) => {
      if (current !== undefined) {
        source.seek?.(current);
      }
      return undefined;
    });
  }, [source]);

  const nudge = (direction: 1 | -1) => {
    // The source's own step first: where there is one, it is because this end
    // cannot be trusted to know the position — see `ITransportSource.nudge`.
    if (source.nudge) {
      source.nudge(direction * NUDGE_MS);
      return;
    }
    source.seek?.(
      Math.min(
        source.durationMs,
        Math.max(0, source.positionMs + direction * NUDGE_MS),
      ),
    );
  };

  return createPortal(
    <div
      ref={barRef}
      className={`now-playing-bar${isIdle ? ' is-idle' : ''}${
        isFloating ? ' is-floating' : ''
      }`}
      role="region"
      aria-label={t('library.nowPlaying')}
    >
      <div className="now-playing-bar__track">
        {/* Pressing it goes to the tab that is playing, the way the library's
            own bar goes to the row in the list. The cover and the two lines
            are one target, because "what is playing" is one thing. */}
        {/* Pressable only while there is somewhere to go. The machine's own
            sound has no tab here, and a press that silently did nothing is
            the one thing worse than a press that is plainly not offered — see
            the stylesheet, where this state keeps its colours rather than
            being dimmed like a control that has been switched off. */}
        <button
          type="button"
          className="now-playing-bar__reveal"
          onClick={onReveal}
          disabled={onReveal === undefined}
          title={contextLabel}
          aria-label={`${contextLabel} — ${source.title}`}
        >
          {/* The same cover the library's bar carries, in the same place. A
              source with no picture of its own gets the generated tile rather
              than a gap, so the bar keeps its shape across tabs. */}
          <LibraryCoverArt
            src={source.artworkUrl}
            label={source.title}
            size="row"
          />
          <span className="now-playing-bar__meta">
            <span className="now-playing-bar__title">{source.title}</span>
            {source.subtitle && (
              <span className="now-playing-bar__artist">{source.subtitle}</span>
            )}
            {/* The library's third line is the codec and the bitrate. Neither
                means anything for a karaoke session or a web page, and left
                out the block was two lines against the library's three and
                the bar changed height on the way between tabs. The tab's own
                name is the honest thing to put there: it says which player
                these buttons belong to, which is the one question a bar that
                follows the tab can raise. */}
            <span className="now-playing-bar__format now-playing-bar__context">
              {contextLabel}
            </span>
          </span>
        </button>
        <SongEqBadge />
      </div>

      {/* The context's own controls where the buttons would be, when it has
          them. Karaoke hands over the transport it already draws — its mix
          faders, its jump-to-start, its pitch tone — because reducing that to
          a play button on the way into a shared bar would take those controls
          away from the one tab that needs them. Same wrapper, same place, and
          the same middle column; the options are the tab's. */}
      {source.hasOwnControls ? (
        <div className="now-playing-bar__adopted" ref={setTransportSlot} />
      ) : (
        <>
          <div className="now-playing-bar__deck">
            <div className="now-playing-bar__buttons">
              {/* A queue either side, for the one source that has one: the
                  machine's own player, and only where Windows says it takes
                  the command. A karaoke session and a web page have no next,
                  and neither draws these. */}
              {source.previous && (
                <button
                  type="button"
                  className="now-playing-bar__control"
                  aria-label={t('library.previous')}
                  title={t('library.previous')}
                  onClick={source.previous}
                >
                  <TransportIcon name="previous" />
                </button>
              )}
              {canStep && (
                <button
                  type="button"
                  className="now-playing-bar__control now-playing-bar__nudge"
                  aria-label={t('library.back5')}
                  title={t('library.back5')}
                  onClick={() => nudge(-1)}
                >
                  <TransportIcon name="back5" />
                </button>
              )}
              <button
                type="button"
                className={`now-playing-bar__control now-playing-bar__play${
                  source.isPlaying ? ' is-playing' : ''
                }`}
                aria-label={
                  source.isPlaying ? t('library.pause') : t('library.play')
                }
                title={
                  source.isPlaying ? t('library.pause') : t('library.play')
                }
                onClick={source.toggle}
              >
                <TransportIcon name={source.isPlaying ? 'pause' : 'play'} />
              </button>
              {canStep && (
                <button
                  type="button"
                  className="now-playing-bar__control now-playing-bar__nudge"
                  aria-label={t('library.forward5')}
                  title={t('library.forward5')}
                  onClick={() => nudge(1)}
                >
                  <TransportIcon name="forward5" />
                </button>
              )}
              {source.next && (
                <button
                  type="button"
                  className="now-playing-bar__control"
                  aria-label={t('library.next')}
                  title={t('library.next')}
                  onClick={source.next}
                >
                  <TransportIcon name="next" />
                </button>
              )}
            </div>
            {canSeek && (
              <div className="now-playing-bar__position">
                <time className="now-playing-bar__time">
                  {formatDuration(shownPosition)}
                </time>
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
                  onChange={(event) => setScrubMs(Number(event.target.value))}
                  onPointerUp={commitScrub}
                  onPointerCancel={commitScrub}
                  onKeyUp={commitScrub}
                  onBlur={commitScrub}
                />
                <time className="now-playing-bar__time">
                  -
                  {formatDuration(
                    Math.max(0, source.durationMs - shownPosition),
                  )}
                </time>
              </div>
            )}
          </div>

          <div className="now-playing-bar__aside">
            <div className="now-playing-bar__secondary">
              {source.setVolume !== undefined && (
                <div className="now-playing-bar__volume">
                  {/* The icon mutes, as it does on every other bar. */}
                  <button
                    type="button"
                    className="now-playing-bar__volume-icon"
                    aria-label={t(
                      (source.volume ?? 1) > 0
                        ? 'library.mute'
                        : 'library.unmute',
                    )}
                    title={t(
                      (source.volume ?? 1) > 0
                        ? 'library.mute'
                        : 'library.unmute',
                    )}
                    aria-pressed={(source.volume ?? 1) === 0}
                    onClick={() => {
                      const current = source.volume ?? 1;
                      if (current > 0) {
                        restoreVolumeRef.current = current;
                        source.setVolume?.(0);
                        return;
                      }
                      source.setVolume?.(restoreVolumeRef.current);
                    }}
                  >
                    <TransportIcon
                      name={(source.volume ?? 1) > 0 ? 'volume' : 'volumeOff'}
                    />
                  </button>
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
                  <span
                    className="now-playing-bar__volume-value"
                    aria-hidden="true"
                  >
                    {Math.round((source.volume ?? 1) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};

export default SourceTransportBar;
