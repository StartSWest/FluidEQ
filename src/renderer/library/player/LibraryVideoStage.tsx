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
  const { videoTrackId, isPlaying, registerVideoElement, toggle, stop } =
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
      />
      {/* The way out. Without it a video owned the whole tab until the queue
          happened to move off it — and a video-only queue at its own end never
          does, so the tab stayed that video until the app was relaunched.
          Stopping rather than merely hiding the stage: the queue holds only
          videos, so leaving it playing behind a closed pane would be sound
          with no picture and no obvious way back to it. */}
      {!isHidden && (
        <>
          <button
            type="button"
            className="button small subtle library-video-stage__back"
            aria-label={t('library.back')}
            title={t('library.back')}
            onClick={stop}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12 4l-6 6 6 6" />
            </svg>
            <span>{t('library.back')}</span>
          </button>
          <button
            type="button"
            className="button small subtle library-video-stage__fullscreen"
            aria-label={t('library.fullScreen')}
            title={t('library.fullScreen')}
            aria-pressed={isFullScreen}
            onClick={onToggleFullScreen}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default LibraryVideoStage;
