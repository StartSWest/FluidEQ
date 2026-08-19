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

import { useEffect, useRef, useState } from 'react';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryPlayer } from './LibraryPlayerContext';
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
 * Fullscreen goes through the same `setWindowFullScreen` IPC call
 * `VideoBrowser` already uses for its own player, not a second mechanism:
 * fullscreen here means this pane fills itself (own CSS, `.is-fullscreen`)
 * while the OS titlebar and taskbar step aside, matching the reasoning in
 * `VideoBrowser.scss` for why the response graph and the rest of the
 * workspace are left exactly where they were rather than torn down too.
 */
const LibraryVideoStage = () => {
  const { t } = useTranslation();
  const { videoTrackId, isPlaying, registerVideoElement, toggle } =
    useLibraryPlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Registration is once-per-element, not once-per-track: the same `<video>`
  // DOM node is reused across a run of consecutive video tracks (React never
  // remounts it, since the condition that renders it — `videoTrackId` being
  // set — stays true the whole time), so only the mount/unmount of the
  // element itself should re-run this.
  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return undefined;
    }
    return registerVideoElement(element);
  }, [registerVideoElement]);

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

  // The window can leave full screen from outside this button — Escape, or
  // the OS chrome — and `App.tsx`'s Karaoke flag resets itself the same way.
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'window-state-changed',
      (...args: unknown[]) => {
        const state = args[0] as { isFullScreen?: boolean } | undefined;
        if (state?.isFullScreen === false) {
          setIsFullScreen(false);
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!videoTrackId && isFullScreen) {
      window.electron.ipcRenderer
        .setWindowFullScreen(false)
        .catch(() => undefined);
      setIsFullScreen(false);
    }
  }, [videoTrackId, isFullScreen]);

  if (!videoTrackId) {
    return null;
  }

  const handleToggleFullScreen = async () => {
    const next = !isFullScreen;
    try {
      const applied =
        await window.electron.ipcRenderer.setWindowFullScreen(next);
      setIsFullScreen(next && applied);
    } catch {
      setIsFullScreen(false);
    }
  };

  return (
    <div
      className={`library-video-stage${isFullScreen ? ' is-fullscreen' : ''}`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a local
          library file carries no caption track to offer; there is nothing to
          associate one with. */}
      <video
        ref={videoRef}
        className="library-video-stage__video"
        src={libraryMediaUrl('track', videoTrackId)}
        onClick={toggle}
      />
      <button
        type="button"
        className="library-video-stage__fullscreen"
        aria-label={t('library.fullScreen')}
        title={t('library.fullScreen')}
        aria-pressed={isFullScreen}
        onClick={handleToggleFullScreen}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" />
        </svg>
      </button>
    </div>
  );
};

export default LibraryVideoStage;
