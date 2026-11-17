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

/**
 * Back and Forward, the way a file browser has them.
 *
 * WRITTEN AT EACH MOVE, NEVER READ OFF THE STATE AFTERWARDS. A move can take
 * two commits to settle — a shelf change closes the drill-in it brings no
 * reading of in an effect after it — and an observer of the state would
 * record the half-way place as a step of its own, so Back would land on a
 * screen nobody stood on. Instead every navigation handler says `remember()`
 * before it moves, which keeps where the reader WAS, and Back puts that back
 * whole in one pass.
 *
 * Kept for the session only: a stored trail would bring back places a rescan
 * may have removed, and the folder and record the reader was in already
 * survive a restart on their own (`libraryWorkspacePrefs.ts`).
 */

import { useCallback, useRef, useState } from 'react';
import type { TLibraryBrowseMode } from '../../common/library/types';

/** Where the reader stands: the shelf and what is open on it. */
export interface ILibraryPlace {
  browseMode: TLibraryBrowseMode;
  folderPath: string | undefined;
  albumId: string | undefined;
  artistId: string | undefined;
  genreId: string | undefined;
  playlistId: string | undefined;
  /**
   * Under a search, the folder was opened from a result rather than only
   * stood in, so Back from it is the results (`isResultFolderOpen`).
   */
  isFolderOpened: boolean;
}

/** Steps kept each way. Enough for an afternoon's browsing, never a leak. */
const MAX_STEPS = 100;

const samePlace = (left: ILibraryPlace, right: ILibraryPlace): boolean =>
  left.browseMode === right.browseMode &&
  left.folderPath === right.folderPath &&
  left.albumId === right.albumId &&
  left.artistId === right.artistId &&
  left.genreId === right.genreId &&
  left.playlistId === right.playlistId &&
  left.isFolderOpened === right.isFolderOpened;

export interface ILibraryHistory {
  /** Call before a move: the place being left becomes Back's. */
  remember: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  /** False when there was nowhere to go. */
  goBack: () => boolean;
  goForward: () => boolean;
}

export const useLibraryHistory = ({
  current,
  restore,
}: {
  /** The place on screen now, read when a move is about to happen. */
  current: ILibraryPlace;
  /** Puts a remembered place back, every part of it in one pass. */
  restore: (place: ILibraryPlace) => void;
}): ILibraryHistory => {
  const currentRef = useRef(current);
  currentRef.current = current;
  const backRef = useRef<ILibraryPlace[]>([]);
  const forwardRef = useRef<ILibraryPlace[]>([]);
  /** The two stacks live in refs; this is what redraws the arrows. */
  const [depths, setDepths] = useState({ back: 0, forward: 0 });
  const publish = useCallback(() => {
    setDepths({
      back: backRef.current.length,
      forward: forwardRef.current.length,
    });
  }, []);

  const remember = useCallback(() => {
    const here = currentRef.current;
    const back = backRef.current;
    const last = back[back.length - 1];
    // A press on what is already open is no step.
    if (last !== undefined && samePlace(last, here)) {
      return;
    }
    back.push(here);
    if (back.length > MAX_STEPS) {
      back.shift();
    }
    // A new move forgets the road ahead, as every browser does.
    forwardRef.current = [];
    publish();
  }, [publish]);

  const travel = useCallback(
    (from: ILibraryPlace[], to: ILibraryPlace[]): boolean => {
      const here = currentRef.current;
      // Places identical to where the reader stands are no step: a move that
      // remembered and then changed nothing would otherwise cost a press.
      let target = from.pop();
      while (target !== undefined && samePlace(target, here)) {
        target = from.pop();
      }
      if (target === undefined) {
        publish();
        return false;
      }
      to.push(here);
      if (to.length > MAX_STEPS) {
        to.shift();
      }
      restore(target);
      publish();
      return true;
    },
    [publish, restore],
  );

  const goBack = useCallback(
    () => travel(backRef.current, forwardRef.current),
    [travel],
  );
  const goForward = useCallback(
    () => travel(forwardRef.current, backRef.current),
    [travel],
  );

  return {
    remember,
    canGoBack: depths.back > 0,
    canGoForward: depths.forward > 0,
    goBack,
    goForward,
  };
};
