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
import { usePlaybackOwner } from './playbackOwner';
import { useIsTransportPlaying } from './transportSource';

interface IIdlePlayerMountOptions {
  isActive: boolean;
  hasLoadedSource: boolean;
  isPlaying: boolean;
  /**
   * The page on screen — anything that changes when the window's page does.
   *
   * A change of it after this player was left is somebody moving on, which is
   * what lets it go.
   */
  page: string;
}

/**
 * Keep a loaded, silent player's shell mounted until somebody has moved on.
 *
 * Active or audible players stay. An empty hidden player leaves immediately. A
 * loaded but silent one stays until the next thing that says its user has gone
 * elsewhere — and then the component unmounts and its own cleanup disposes
 * media elements, observers, animation loops, web contents and native
 * resources. Returning to the tab mounts it again and lets its persisted
 * session restore normally. What says somebody moved on:
 *
 *   - another page after the one they left it for. Leaving a player's tab for
 *     one page and coming straight back — a quick look, the empty-bar glitch
 *     this lease exists to avoid — keeps it; a second step away is not a
 *     quick look;
 *   - another player starting to play, here or on the machine. Its sound
 *     replaces this one's, and the bar goes to it;
 *   - the window hidden or minimised. Nobody is looking at any of it.
 *
 * It was a five-second lease on a timer: long enough, it was argued, for a
 * quick tab check to feel continuous. Five seconds is a guess at how long a
 * look takes, and a wrong one both ways — too short for somebody reading the
 * page they switched to, pointless for somebody who put the window away the
 * moment they left. None of the three signals is a guess.
 */
export const useIdlePlayerMount = ({
  isActive,
  hasLoadedSource,
  isPlaying,
  page,
}: IIdlePlayerMountOptions): boolean => {
  const isHeld = !isActive && !isPlaying && hasLoadedSource;
  const [isReleased, setIsReleased] = useState(
    () => !isActive && !isPlaying && !hasLoadedSource,
  );
  // The page as it is now, for the moment the player is left: that page is
  // where it was left for, and only a page after it counts.
  const pageRef = useRef(page);
  pageRef.current = page;
  const heldOnPageRef = useRef(page);
  const owner = usePlaybackOwner();
  const lastOwnerRef = useRef(owner);
  const isSystemPlaying = useIsTransportPlaying('system');
  const wasSystemPlayingRef = useRef(isSystemPlaying);

  // Entering or leaving the held state.
  useEffect(() => {
    if (isActive || isPlaying) {
      setIsReleased(false);
      return;
    }
    if (!hasLoadedSource) {
      setIsReleased(true);
      return;
    }
    setIsReleased(false);
    heldOnPageRef.current = pageRef.current;
  }, [hasLoadedSource, isActive, isPlaying]);

  // Another page after the one it was left for.
  useEffect(() => {
    if (isHeld && page !== heldOnPageRef.current) {
      setIsReleased(true);
    }
  }, [isHeld, page]);

  // Another of this app's players starting. Only a start: one already playing
  // when this player was left has said nothing since, and a player stopping
  // is not somebody moving on.
  useEffect(() => {
    if (isHeld && owner !== undefined && owner !== lastOwnerRef.current) {
      setIsReleased(true);
    }
    lastOwnerRef.current = owner;
  }, [isHeld, owner]);

  // The machine's own player starting — a browser tab, Spotify. The same:
  // only a start.
  useEffect(() => {
    if (isHeld && isSystemPlaying && !wasSystemPlayingRef.current) {
      setIsReleased(true);
    }
    wasSystemPlayingRef.current = isSystemPlaying;
  }, [isHeld, isSystemPlaying]);

  // The window put away.
  useEffect(() => {
    if (!isHeld) {
      return undefined;
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsReleased(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isHeld]);

  return isActive || isPlaying || (hasLoadedSource && !isReleased);
};

export default useIdlePlayerMount;
