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

import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import { useTranslation } from '../../utils/I18nContext';
import { useGraphFullScreen } from '../../utils/graphStyle';
import {
  toggleFilmFullScreenTopBar,
  useFilmFullScreenTopBar,
} from '../../utils/fullScreenPins';
import { useIsChromeIdle } from '../../utils/idleChrome';
import FullScreenToggles from '../../widgets/FullScreenToggles';
import ViewBar from '../../widgets/ViewBar';
import { setCaptionsMoving, useCaptionsMoving } from '../subtitleStyleStore';
import { useLibraryPlayerSession } from './LibraryPlayerContext';
import LibraryVideoCaptions from './LibraryVideoCaptions';
import LibraryVideoCaptionsMenu from './LibraryVideoCaptionsMenu';
import {
  readVideoPosition,
  restorablePositionMs,
  writeVideoPosition,
} from './playbackMemory';
import '../../styles/NowPlayingBar.scss';

/**
 * How far one arrow press skips through a film: 5 s, YouTube's step for the
 * arrows, and 10 s with Ctrl, its step for J and L (Ivan, 2026-11-15:
 * "arrows move 5 secs and Ctrl arrows 10 sec, or what is the standard").
 */
const SEEK_STEP_MS = 5000;
const SEEK_LONG_STEP_MS = 10_000;

/**
 * The video half of the player: a `<video>` filling the Library tab's body
 * for as long as `videoTrackId` is set, and nothing at all otherwise.
 *
 * Registers its element with `LibraryPlayerContext` rather than owning
 * playback itself, so `NowPlayingBar`'s one play/pause button keeps working
 * for a video exactly the way it does for a song — see
 * `registerVideoElement`'s doc comment.
 *
 * Fullscreen is controlled by App. Media, Library and Karaoke therefore resize
 * the same BrowserWindow and keep the same state when the selected tab changes.
 */
interface ILibraryVideoStageProps {
  /** Keep only the registered media engine; no invisible controls or paint. */
  isHidden?: boolean;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

const LibraryVideoStage = ({
  isHidden = false,
  isFullScreen,
  onToggleFullScreen,
}: ILibraryVideoStageProps) => {
  const { t } = useTranslation();
  const {
    track,
    videoTrackId,
    isPlaying,
    registerVideoElement,
    toggle,
    closeVideo,
    seek,
    readPositionMs,
  } = useLibraryPlayerSession();
  const videoTrack = track?.id === videoTrackId ? track : undefined;
  const isMovingCaptions = useCaptionsMoving();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** The element as state too, for the captions, which follow its frames
   * and its size and so must hear of it when it arrives and goes. */
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  /**
   * The graph is expanded or full screen over this tab, so the picture behind
   * it should be this video rather than the record sleeve.
   *
   * `LibraryStageArt` draws the cover of whatever is playing behind the plot
   * — which for a video is the still it was never about. It stands down while
   * this is up (see its own guard) and the stage takes the window instead, so
   * the graph is drawn over the thing that is actually moving.
   */
  const isBehindGraph = useGraphFullScreen();
  /** The full-screen row goes with the chrome when the pointer rests. */
  const isChromeIdle = useIsChromeIdle();
  const hasTopBar = useFilmFullScreenTopBar();

  /**
   * Registration, keyed on the DOM node itself rather than on a `useEffect`.
   *
   * A `useEffect(() => registerVideoElement(videoRef.current), [registerVideoElement])`
   * was here first, and it never actually registered anything: `videoRef`
   * is a plain ref, not a dependency React can see, and `registerVideoElement`
   * is stable across renders (it is `useCallback`-memoised in
   * `LibraryPlayerContext` on deps that never change), so that effect ran
   * exactly once — at this component's first mount, while `videoTrackId` was
   * still unset and `videoRef.current` was still `null` because the `<video>`
   * below had not rendered yet. It never ran again, so `toggle`/`seek`/volume
   * never reached a real element and the pause-on-leave fix in
   * `registerVideoElement`'s own cleanup never ran either — a test built to
   * exercise it caught this instead.
   *
   * React 19's callback refs fire on the DOM node's own attach and detach —
   * exactly the event this needs — and can return their own cleanup
   * directly, which is exactly `registerVideoElement`'s shape already
   * (`(element) => () => void`). `videoRef` still exists for the effect
   * below, which needs to read the element back out on its own schedule
   * rather than being handed it once.
   */
  const setVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      setVideoElement(element);
      const unregister = registerVideoElement(element);
      return () => {
        setVideoElement(null);
        unregister();
      };
    },
    [registerVideoElement],
  );

  // Keeps the element's own transport state following the shared `isPlaying`
  // flag — including right after `src` changes to the next video, which the
  // browser pauses automatically as part of loading a new resource.
  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    if (isPlaying && element.paused) {
      element.play().catch(() => undefined);
    } else if (!isPlaying && !element.paused) {
      element.pause();
    }
  }, [isPlaying, videoTrackId]);

  /**
   * WHERE THIS VIDEO WAS LEFT, WRITTEN WHENEVER IT STOPS BEING WATCHED.
   *
   * Three moments, and each is a real event rather than a clock: the video
   * changing or the stage closing (this effect's own cleanup), and the window
   * going away (`pagehide`, which is what a refresh and a quit both fire and
   * the only thing either of them fires). Nothing is written while it plays —
   * there is nothing to remember until somebody stops watching, and a store
   * rewritten four times a second would be doing that work for a number that
   * only matters once.
   *
   * The id is captured rather than read at cleanup time so the position lands
   * on the video it belongs to: by the time the cleanup runs the queue has
   * already moved on, and reading the current id there would file every
   * video's playhead under the NEXT one.
   */
  useEffect(() => {
    if (!videoTrackId) {
      return undefined;
    }
    const remember = () => {
      const element = videoRef.current;
      if (!element) {
        return;
      }
      // Its own end is not a place to come back to — a video watched through
      // starts again next time, which is what removing the entry does.
      const positionMs = element.ended ? 0 : element.currentTime * 1000;
      writeVideoPosition(videoTrackId, positionMs);
    };
    window.addEventListener('pagehide', remember);
    return () => {
      window.removeEventListener('pagehide', remember);
      remember();
    };
  }, [videoTrackId]);

  /**
   * A press pauses or plays; a double-press goes full screen and leaves the
   * film as it was (Ivan, 2026-11-15: "when double clicking for fullscreen
   * don't make the video stop, only when the user clicks once"). The two
   * presses of a double-press are two clicks, and nothing can know at the
   * first whether a second is coming without waiting on a clock, so the
   * second (`detail` 2) gives back what the first did: the picture stops
   * for the length of a double-press and plays on.
   */
  const onPress = (event: MouseEvent<HTMLVideoElement>) => {
    // While the captions are being moved, a press on the film beside them
    // puts them down; it is not asking to pause (Ivan, 2026-11-15).
    if (isMovingCaptions) {
      setCaptionsMoving(false);
      return;
    }
    if (event.detail <= 2) {
      toggle();
    }
  };

  /**
   * How far the arrows have just skipped, flashed in the middle of the
   * picture (Ivan, 2026-11-15: "show how much forward or backward the video
   * jumped in the centre of the screen when I seek via keys"). Presses the
   * same way add up while it shows; its fade's own end takes it away, and a
   * new press restarts the fade (`nonce` is its key).
   */
  const [skipped, setSkipped] = useState<
    { totalMs: number; nonce: number } | undefined
  >(undefined);

  /** The arrows skip through the film while it has the focus, as every
   * player on this machine does. */
  const onKey = (event: KeyboardEvent<HTMLVideoElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const length = event.ctrlKey ? SEEK_LONG_STEP_MS : SEEK_STEP_MS;
    const step = event.key === 'ArrowLeft' ? -length : length;
    seek(Math.max(0, readPositionMs() + step));
    setSkipped((shown) => ({
      totalMs:
        shown !== undefined && Math.sign(shown.totalMs) === Math.sign(step)
          ? shown.totalMs + step
          : step,
      nonce: (shown?.nonce ?? 0) + 1,
    }));
  };

  if (!videoTrackId) {
    return null;
  }

  return (
    <div
      hidden={isHidden}
      className={`library-video-stage${isFullScreen ? ' is-fullscreen' : ''}${
        isBehindGraph ? ' is-behind-graph' : ''
      }`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions
          are drawn over the picture by `LibraryVideoCaptions`, not through a
          <track>: SubRip has no <track> form, and a cue drawn by the browser
          can be neither placed by the viewer nor dragged. */}
      <video
        ref={setVideoRef}
        className="library-video-stage__video"
        src={libraryMediaUrl('track', videoTrackId)}
        // Focusable, so the arrows reach it once it has been pressed.
        tabIndex={0}
        onClick={onPress}
        onDoubleClick={onToggleFullScreen}
        onKeyDown={onKey}
        // BACK WHERE IT WAS LEFT, AND NOT BEFORE THE METADATA IS IN.
        //
        // `currentTime` assigned while the element is still at
        // `HAVE_NOTHING` is what empties the seekable range and breaks
        // seeking for the whole of that load — the same trap the audio
        // loader's own restore documents, and the reason both wait for this
        // event rather than seeking at load time. The duration is known by
        // now too, which is what lets the last few seconds be refused: a
        // video restored to its own ending is a film that ends the moment it
        // is opened.
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          const stored = readVideoPosition(videoTrackId);
          if (stored === undefined) {
            return;
          }
          const restore = restorablePositionMs(
            stored,
            Number.isFinite(element.duration)
              ? element.duration * 1000
              : undefined,
          );
          if (restore !== undefined) {
            element.currentTime = restore / 1000;
          }
        }}
      />
      {/* On the picture, in the tab and in full screen, under the stage's
          controls; nothing at all while the stage only keeps the media
          engine (`isHidden`). */}
      {!isHidden && (
        <LibraryVideoCaptions
          video={videoElement}
          track={videoTrack}
          isFullScreen={isFullScreen}
        />
      )}
      {/* On the side it skipped toward, as a big arrow with the seconds
          under it, flat on the picture (Ivan, 2026-11-15: "make it more our
          flat style and show a big arrow, next and previous, to each side"). */}
      {skipped !== undefined && (
        <div
          key={skipped.nonce}
          className={`library-video-stage__skip ${
            skipped.totalMs < 0 ? 'is-back' : 'is-forward'
          }`}
          aria-live="polite"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) {
              setSkipped(undefined);
            }
          }}
        >
          <svg
            className="library-video-stage__skip-arrow"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d={
                skipped.totalMs < 0
                  ? 'M12 6l-6 6 6 6M18 6l-6 6 6 6'
                  : 'M6 6l6 6-6 6M12 6l6 6-6 6'
              }
            />
          </svg>
          <span className="library-video-stage__skip-label">
            {t('library.video.skip', {
              seconds: `${skipped.totalMs < 0 ? '−' : '+'}${Math.abs(skipped.totalMs) / 1000}`,
            })}
          </span>
        </div>
      )}
      {/* In full screen, where the transport floats and the place bar is not
          drawn, the film's row, as every page has one (`ViewBar`; Ivan,
          2026-11-16: "the same base bar for all the screens"): the way back
          out of the film, what it is, the captions' quick switch, and the
          full-screen icons. In the tab the bar's own back arrow and place
          bar lead out of the film, the pane beside it holds the captions,
          and full screen is the double-click and Ctrl+F, as on every video
          player on this machine: nothing is drawn on the picture there.

          Back stops the film rather than hiding the stage: the queue may
          hold only videos, and one left playing behind a closed pane would
          be sound with no picture and no obvious way back to it. */}
      {!isHidden && isFullScreen && (
        <ViewBar
          className="library-video-bar"
          isIdle={isChromeIdle}
          label={t('tabs.library')}
        >
          <button
            type="button"
            className="button small subtle library-video-bar__back"
            aria-label={t('library.back')}
            title={t('library.back')}
            // Out of full screen as well: `useVideoFullScreenExit` takes the
            // window down whenever the film leaves.
            onClick={closeVideo}
          >
            <svg className="view-bar__glyph" viewBox="0 0 20 20" aria-hidden>
              <path d="M12 4l-6 6 6 6" />
            </svg>
            <span>{t('library.back')}</span>
          </button>
          <p className="view-bar__crumb">
            <span>{t('tabs.library')}</span>
            {videoTrack && (
              <>
                <span aria-hidden="true">›</span>
                <strong title={videoTrack.title}>{videoTrack.title}</strong>
              </>
            )}
          </p>
          <LibraryVideoCaptionsMenu track={videoTrack} />
          <FullScreenToggles
            isFullScreen
            hasTopBar={hasTopBar}
            onToggleTopBar={toggleFilmFullScreenTopBar}
            onToggleFullScreen={onToggleFullScreen}
          />
        </ViewBar>
      )}
    </div>
  );
};

export default LibraryVideoStage;
