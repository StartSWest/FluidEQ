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
 * Which way the Folders view is read: as a tree, or as every folder at once.
 *
 * Two honest answers to the same question, and which one is wanted depends on
 * what somebody is doing. THE TREE is a file manager: the folders that were
 * added, then what is inside them, one level at a time. It is how you look at
 * a library you organised yourself, and the only way to see that thirty of
 * the forty albums live inside one place.
 *
 * THE FLAT LIST is every directory that holds a file, all at once, with its
 * path underneath. It is worse for browsing and better for finding: type four
 * letters into the search box and the folder you meant is on screen, wherever
 * it happens to sit.
 *
 * Not a view mode. The list and the grid both draw either of these, because
 * this decides *which folders* a level holds and not how they are drawn.
 *
 * The tree by default: it is the arrangement the files are actually in.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fluideq.library.folderTree';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

let asTree = read();

export const isFolderTree = (): boolean => asTree;

export const setFolderTree = (next: boolean): void => {
  if (next === asTree) {
    return;
  }
  asTree = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // Storage can be unavailable; the choice then lasts as long as the window.
  }
  emit();
};

export const useFolderTree = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => asTree,
    () => true,
  );
