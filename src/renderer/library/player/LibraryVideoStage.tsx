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

import { useCallback, useEffect, useRef } from 'react';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import { useTranslation } from '../../utils/I18nContext';
import { useGraphFullScreen } from '../../utils/graphStyle';
import { useLibraryPlayerSession } from './LibraryPlayerContext';
import {
  readVideoPosition,
  restorablePositionMs,
  writeVideoPosition,
} from './playbackMemory';
import '../../styles/NowPlayingBar.scss';

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
  const { videoTrackId, isPlaying, registerVideoElement, toggle, closeVideo } =
    useLibraryPlayerSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      return registerVideoElement(element);
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
   * Back: out of full screen as well as out of the video.
   *
   * Leaving the picture while the window stays full screen puts the reader on
   * a library shelf with no titlebar and no way back to the rest of the app —
   * a mode with nothing left in it that the mode was for. The window comes
   * down first, so there is never a frame of a full-screen tab with no video
   * in it.
   */
  const goBack = () => {
    if (isFullScreen) {
      onToggleFullScreen();
    }
    closeVideo();
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
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a local
          library file carries no caption track to offer; there is nothing to
          associate one with. */}
      <video
        ref={setVideoRef}
        className="library-video-stage__video"
        src={libraryMediaUrl('track', videoTrackId)}
        onClick={toggle}
        onDoubleClick={onToggleFullScreen}
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
      {/* The way out, and the only control drawn on the picture.
          Without it a video owned the whole tab until the queue happened to
          move off it — and a video-only queue at its own end never does, so
          the tab stayed that video until the app was relaunched. Stopping
          rather than merely hiding the stage: the queue holds only videos, so
          leaving it playing behind a closed pane would be sound with no
          picture and no obvious way back to it.

          THERE IS NO FULL-SCREEN BUTTON. Full screen is the double-click on
          the picture and Ctrl+F, which is what every video player on this
          machine already answers to — a button in the corner is a third
          spelling of a command nobody was looking for one for, and it cost
          the top-right corner of every video to say it. */}
      {!isHidden && (
        <button
          type="button"
          className="button small library-video-stage__back"
          aria-label={t('library.back')}
          title={t('library.back')}
          onClick={goBack}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" />
          </svg>
          <span>{t('library.back')}</span>
        </button>
      )}
    </div>
  );
};

export default LibraryVideoStage;
