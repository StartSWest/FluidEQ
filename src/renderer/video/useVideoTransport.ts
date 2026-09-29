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

import { type RefObject, useEffect } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import {
  clearTransportSource,
  setTransportSource,
} from '../audio/transportSource';
import {
  nudgePositionScript,
  PROBE_PLAYBACK,
  PROBE_PLAYBACK_PHASE,
  PROBE_SKIP_CONTROLS,
  READ_NOW_PLAYING,
  READ_PLAYBACK_CLOCK,
  skipScript,
  STOP_AND_RESET_PLAYBACK,
  STOP_PLAYBACK,
  TOGGLE_PLAYBACK,
} from './videoPlayerScripts';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../audio/playbackOwner';
import { PLAYBACK_HANDOFF_GRACE_MS } from '../audio/playbackHandoff';
import { type IWebview } from './videoWebview';
import { type Translate } from '../../common/i18n';

/** Four bar updates a second; visual guest work remains stopped off-tab. */
const TRANSPORT_CLOCK_SAMPLE_MS = 250;

interface IVideoTransportInput {
  webviewRef: RefObject<IWebview | null>;
  nowPlayingRef: RefObject<{ title?: string; artist?: string }>;
  t: Translate;
  frameRef: RefObject<string | undefined>;
  playingRef: RefObject<boolean>;
  skipsRef: RefObject<{ next: boolean; previous: boolean }>;
  nowPlayingProbeRef: RefObject<() => void>;
  notePlayingPositionRef: RefObject<(seconds: number) => void>;
  isHiddenRef: RefObject<boolean>;
}

/**
 * The Media tab's place in the app's playback: the one-player rule, both
 * ways, through what the guest will tell and what it lets us ask; and the
 * transport handed to the bar at the foot of the window while this tab
 * drives it — title, picture, play, pause, stop, level and the clock.
 */
const useVideoTransport = ({
  webviewRef,
  nowPlayingRef,
  t,
  frameRef,
  playingRef,
  skipsRef,
  nowPlayingProbeRef,
  notePlayingPositionRef,
  isHiddenRef,
}: IVideoTransportInput) => {
  /**
   * This pane's half of the one-player rule.
   *
   * The guest is a whole browser and we do not own what it is doing, so both
   * directions go through the two things a `<webview>` will tell us and the
   * one thing it will let us ask. `media-started-playing` is the claim — by
   * the time it fires the page is already making sound, which is exactly when
   * the album underneath it should stop. `media-paused` gives it back. And
   * being asked to stop is a script that pauses every media element on the
   * page: not a user gesture, so it cannot start anything, only end it.
   *
   * Anything the page opens in its own window is beyond this, and honestly so
   * — we can only speak to the contents we embedded.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) {
      return undefined;
    }
    /**
     * What the bar shows while the Media tab is the one being looked at.
     *
     * Title, play, pause and stop, a fader, five seconds either way — and the
     * page's own skip buttons where the page has them.
     *
     * No seek SLIDER, still: there is no playhead we own to move and this
     * pane learns the position from a sample every few seconds, so a slider
     * would be a control that lies about where it is. The step is done inside
     * the page instead, which does know.
     *
     * "Next" belongs to whatever site is loaded and means something different
     * on each — the queue on YouTube Music, the album on Bandcamp, nothing at
     * all on a live stream — so the answer is not a rule of ours but the
     * page's own button, pressed where the page has one and not offered where
     * it does not. See `PROBE_SKIP_CONTROLS`.
     */
    let playbackRevision = 0;
    let retainForHandoff = false;
    let isDisposed = false;
    let playbackClockPositionMs = 0;
    let playbackClockDurationMs = 0;
    let playbackClockFrame = 0;
    let playbackClockRevision = 0;
    let playbackClockReadPending = false;
    let lastPlaybackClockRead = -Infinity;
    let handoffFrame = 0;
    let handoffDeadline = 0;
    const describe = (isPlaying: boolean) => {
      // The song where the page publishes one, the page otherwise.
      //
      // A document title is the site, not the track: Suno reads "Suno | AI
      // Music" through every song it plays, and YouTube Music keeps the tab's
      // name while the queue moves underneath it. What those players hand the
      // lock screen is `mediaSession.metadata`, and that is what this bar
      // carries too — see `READ_NOW_PLAYING`.
      const resolvedTitle =
        nowPlayingRef.current.title || view.getTitle() || t('tabs.media');
      setTransportSource({
        owner: 'media',
        title: resolvedTitle,
        subtitle: nowPlayingRef.current.artist || undefined,
        artworkUrl: frameRef.current,
        // The URL is the exact key, plus the track the page published where
        // it published one: two pages can share a title (every unplayed
        // YouTube tab is "YouTube") but never a URL — and an album page keeps
        // one URL across every track on it. `nowPlayingRef` holds ONLY what
        // `mediaSession.metadata` gave us, which is why the published title is
        // passed separately from the resolved one the bar draws.
        identity: buildSongIdentity(
          'media',
          view.getURL(),
          resolvedTitle,
          nowPlayingRef.current.artist,
          nowPlayingRef.current.title,
        ),
        isPlaying,
        retainWhenHidden: retainForHandoff || undefined,
        positionMs: playbackClockPositionMs,
        durationMs: playbackClockDurationMs,
        toggle: () => {
          try {
            // The one call in this pane made WITH a user gesture, because it
            // is one: the reader pressed play on our own bar, and without the
            // activation the guest's `play()` is refused by the autoplay
            // policy the tag is loaded under.
            view
              .executeJavaScript(TOGGLE_PLAYBACK, true)
              .catch(() => undefined);
          } catch {
            // No web contents to ask.
          }
        },
        stop: () => {
          // Stop is a state of this loaded Media page, not the removal of its
          // source. Publish the paused beginning before asking the guest so
          // its later `media-paused` event can only confirm the same bar.
          playbackRevision += 1;
          setHandoffRetention(false);
          stopPlaybackClock();
          playingRef.current = false;
          playbackClockPositionMs = 0;
          describe(false);
          releasePlayback('media');
          try {
            view
              .executeJavaScript(STOP_AND_RESET_PLAYBACK)
              .catch(() => undefined);
          } catch {
            // The loaded description remains; the guest can be retried once it
            // is attached again instead of replacing the bar with idle chrome.
          }
        },
        // Five seconds either way, done inside the page.
        //
        // No `seek` beside it, and that is the honest pair: this pane learns
        // the position from a sample every few seconds — enough to remember
        // where a video was left, nowhere near enough to drive a slider — so
        // the bar gets the step it can offer truthfully rather than a slider
        // it could not. The page holds the playhead and does the arithmetic:
        // see `nudgePositionScript`.
        nudge: (deltaMs: number) => {
          try {
            view
              .executeJavaScript(nudgePositionScript(deltaMs / 1000))
              .catch(() => undefined);
          } catch {
            // No web contents to ask.
          }
        },
        // The page's own, and only where the page has one. `skipsRef` is what
        // the last probe found — see the probe below, which runs on every
        // navigation because a queue appears and disappears with the page.
        next: skipsRef.current.next ? () => press('next') : undefined,
        previous: skipsRef.current.previous
          ? () => press('previous')
          : undefined,
        // The level itself is not published — the bar reads the app's fader,
        // which is the same number every other tab plays at. This only says
        // the page can be set, and does it. See `ITransportSource.setVolume`.
      });
    };
    const stopPlaybackClock = () => {
      playbackClockRevision += 1;
      if (playbackClockFrame !== 0) {
        window.cancelAnimationFrame(playbackClockFrame);
        playbackClockFrame = 0;
      }
    };
    const samplePlaybackClock = (renderTime: number) => {
      if (isDisposed || !playingRef.current) {
        playbackClockFrame = 0;
        return;
      }
      if (
        renderTime - lastPlaybackClockRead >= TRANSPORT_CLOCK_SAMPLE_MS &&
        !playbackClockReadPending
      ) {
        lastPlaybackClockRead = renderTime;
        playbackClockReadPending = true;
        const revision = playbackClockRevision;
        try {
          view
            .executeJavaScript(READ_PLAYBACK_CLOCK)
            .then((clock) => {
              playbackClockReadPending = false;
              if (
                isDisposed ||
                !playingRef.current ||
                playbackClockRevision !== revision
              ) {
                return clock;
              }
              const record = (clock ?? {}) as Record<string, unknown>;
              const previousPositionMs = playbackClockPositionMs;
              const previousDurationMs = playbackClockDurationMs;
              playbackClockPositionMs =
                typeof record.positionMs === 'number' &&
                Number.isFinite(record.positionMs)
                  ? record.positionMs
                  : 0;
              playbackClockDurationMs =
                typeof record.durationMs === 'number' &&
                Number.isFinite(record.durationMs)
                  ? record.durationMs
                  : 0;
              // A queue moving on inside one document — a Suno playlist, a
              // YouTube Music queue — changes no address and fires no
              // navigation. What it does change is this clock: another
              // length, or the playhead back near the start. That is when
              // the page is asked what it is playing now; it was asked every
              // five seconds on a timer instead.
              if (
                playbackClockDurationMs !== previousDurationMs ||
                playbackClockPositionMs < previousPositionMs
              ) {
                nowPlayingProbeRef.current();
              }
              // The same reading is where this site's video was left, if the
              // window closes or crashes before the next one.
              notePlayingPositionRef.current(playbackClockPositionMs / 1000);
              describe(true);
              return clock;
            })
            .catch(() => {
              playbackClockReadPending = false;
            });
        } catch {
          playbackClockReadPending = false;
        }
      }
      playbackClockFrame = window.requestAnimationFrame(samplePlaybackClock);
    };
    const startPlaybackClock = () => {
      stopPlaybackClock();
      lastPlaybackClockRead = -Infinity;
      playbackClockFrame = window.requestAnimationFrame(samplePlaybackClock);
    };
    const setHandoffRetention = (retain: boolean) => {
      if (handoffFrame !== 0) {
        window.cancelAnimationFrame(handoffFrame);
        handoffFrame = 0;
      }
      retainForHandoff = retain;
      if (!retain) {
        handoffDeadline = 0;
        return;
      }
      handoffDeadline = performance.now() + PLAYBACK_HANDOFF_GRACE_MS;
      const watchHandoff = (now: number) => {
        if (isDisposed || !retainForHandoff) {
          handoffFrame = 0;
          return;
        }
        if (now >= handoffDeadline) {
          handoffFrame = 0;
          retainForHandoff = false;
          describe(false);
          return;
        }
        handoffFrame = window.requestAnimationFrame(watchHandoff);
      };
      handoffFrame = window.requestAnimationFrame(watchHandoff);
    };
    const onPlaying = () => {
      playbackRevision += 1;
      setHandoffRetention(false);
      playingRef.current = true;
      claimPlayback('media');
      describe(true);
      startPlaybackClock();
      nowPlayingProbeRef.current();
      // A frame taken now is a frame of the thing that just started, which is
      // a better picture than the page's poster or its cookie banner.
      grabFrame();
    };
    const onPaused = () => {
      playingRef.current = false;
      stopPlaybackClock();
      const revision = playbackRevision + 1;
      playbackRevision = revision;
      const settlePausedState = (phase: unknown) => {
        if (isDisposed || playbackRevision !== revision) {
          return;
        }
        if (phase === 'playing') {
          onPlaying();
          return;
        }
        // Every natural end gets the bounded lease. Some sites autoplay a
        // queue without exposing a usable Next control; the real next
        // `playing` event cancels it, and expiry handles a final item.
        setHandoffRetention(phase === 'ended');
        describe(false);
        releasePlayback('media');
      };
      try {
        view
          .executeJavaScript(PROBE_PLAYBACK_PHASE)
          .then(settlePausedState)
          .catch(() => settlePausedState('paused'));
      } catch {
        settlePausedState('paused');
      }
    };
    /**
     * Ask the page what it has, and describe it or take the bar away.
     *
     * The tag's own events only fire when playback starts or stops, so a page
     * that arrives with a paused video — which is every video, under the
     * autoplay policy this tag is loaded with — announced nothing, and the
     * Media tab sat there with no bar until something was played. Run when a
     * page finishes arriving instead, and the bar is there to press.
     */
    /**
     * A still of the page, for the bar's cover.
     *
     * The guest is a web page and has no artwork to ask for, so the picture
     * is the picture: one frame, cut down to bar height. Skipped while the
     * tab is hidden — a webview nobody is looking at captures black, and a
     * black square is worse than the generated tile it would replace.
     */
    const grabFrame = () => {
      if (isHiddenRef.current) {
        return;
      }
      try {
        view
          .capturePage()
          .then((image) => {
            if (image.isEmpty()) {
              return undefined;
            }
            // 72 rather than the bar's 36: the cover is drawn at a device
            // pixel ratio this process cannot know, and a picture asked for
            // at exactly its drawn size is the one that looks soft.
            frameRef.current = image.resize({ height: 72 }).toDataURL();
            describe(playingRef.current);
            return undefined;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to photograph.
      }
    };

    /**
     * Press the page's own skip control.
     *
     * With a user gesture, which is what it is: somebody pressed a transport
     * button on our bar, and the next track does not start under the guest's
     * autoplay policy without it — see `VIDEO_WEB_PREFERENCES`.
     */
    const press = (direction: 'next' | 'previous') => {
      try {
        view
          .executeJavaScript(skipScript(direction), true)
          // The page it lands on is a different page: probe again so the
          // buttons match what the new one has, and so the title on the bar
          // is the track that is now playing.
          .then(() => probeSkips())
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };

    /**
     * What the page can be asked to skip to, asked of the page.
     *
     * On every navigation, because it changes with one: a YouTube video
     * opened on its own has no next until it is opened from a playlist, and
     * YouTube Music has neither until something is queued.
     */
    const probeSkips = () => {
      try {
        view
          .executeJavaScript(PROBE_SKIP_CONTROLS)
          .then((found) => {
            const record = (found ?? {}) as Record<string, unknown>;
            const next = record.next === true;
            const previous = record.previous === true;
            if (
              next === skipsRef.current.next &&
              previous === skipsRef.current.previous
            ) {
              return found;
            }
            skipsRef.current = { next, previous };
            describe(playingRef.current);
            return found;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };

    /**
     * What the page says is playing, asked of the page.
     *
     * Cheap and idempotent, so it runs anywhere the answer could have moved:
     * on navigation with the rest of the probe, when playback starts, and when
     * the playback clock reads another track's length or a playhead gone
     * back — a queue advancing without the document changing at all, as a
     * Suno playlist or a YouTube Music queue does.
     */
    const probeNowPlaying = () => {
      try {
        view
          .executeJavaScript(READ_NOW_PLAYING)
          .then((found) => {
            const record = (found ?? {}) as Record<string, unknown>;
            const title =
              typeof record.title === 'string' ? record.title : undefined;
            const artist =
              typeof record.artist === 'string' && record.artist
                ? record.artist
                : undefined;
            if (
              title === nowPlayingRef.current.title &&
              artist === nowPlayingRef.current.artist
            ) {
              return found;
            }
            nowPlayingRef.current = { title, artist };
            describe(playingRef.current);
            return found;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };
    nowPlayingProbeRef.current = probeNowPlaying;

    const probe = () => {
      probeSkips();
      probeNowPlaying();
      try {
        view
          .executeJavaScript(PROBE_PLAYBACK)
          .then((state) => {
            if (typeof state !== 'boolean') {
              clearTransportSource('media');
              return state;
            }
            playingRef.current = state;
            if (state) {
              setHandoffRetention(false);
              claimPlayback('media');
              startPlaybackClock();
            }
            describe(state);
            grabFrame();
            return state;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };
    view.addEventListener('media-started-playing', onPlaying);
    view.addEventListener('media-paused', onPaused);
    view.addEventListener('dom-ready', probe);
    view.addEventListener('did-navigate', probe);
    view.addEventListener('did-navigate-in-page', probe);
    view.addEventListener('page-title-updated', probe);
    const unregister = registerPlayer('media', () => {
      playbackRevision += 1;
      setHandoffRetention(false);
      stopPlaybackClock();
      playingRef.current = false;
      describe(false);
      releasePlayback('media');
      try {
        view.executeJavaScript(STOP_PLAYBACK).catch(() => undefined);
      } catch {
        // No web contents to ask — nothing is playing in one that is gone.
      }
    });
    return () => {
      isDisposed = true;
      playbackRevision += 1;
      setHandoffRetention(false);
      stopPlaybackClock();
      view.removeEventListener('media-started-playing', onPlaying);
      view.removeEventListener('media-paused', onPaused);
      view.removeEventListener('dom-ready', probe);
      view.removeEventListener('did-navigate', probe);
      view.removeEventListener('did-navigate-in-page', probe);
      view.removeEventListener('page-title-updated', probe);
      unregister();
      clearTransportSource('media');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export default useVideoTransport;
