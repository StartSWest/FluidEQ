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

import { useSyncExternalStore } from 'react';
import {
  type ISubtitleStyle,
  parseSubtitleStyle,
} from '../../common/library/subtitleStyle';

/** The captions' look and place, per viewer (`settingsReset.ts` forgets it). */
export const SUBTITLE_STYLE_KEY = 'fluideq.library.subtitleStyle';

/**
 * The captions' style, one copy for the window: the Subtitles tab writes
 * it, the captions over the picture read it, and both re-render together.
 * Read from storage once, on first use; a storage that refuses (a private
 * profile, a quota) leaves the defaults and a style that lasts the session.
 */
let style: ISubtitleStyle | undefined;
const styleListeners = new Set<() => void>();

const readStyle = (): ISubtitleStyle => {
  if (style === undefined) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(SUBTITLE_STYLE_KEY);
    } catch {
      // Storage refused: the defaults stand.
    }
    style = parseSubtitleStyle(raw);
  }
  return style;
};

const subscribeStyle = (listener: () => void) => {
  styleListeners.add(listener);
  return () => {
    styleListeners.delete(listener);
  };
};

export const useSubtitleStyle = (): ISubtitleStyle =>
  useSyncExternalStore(subscribeStyle, readStyle);

/** Changes some of the style and keeps all of it. */
export const updateSubtitleStyle = (change: Partial<ISubtitleStyle>): void => {
  style = { ...readStyle(), ...change };
  try {
    window.localStorage.setItem(SUBTITLE_STYLE_KEY, JSON.stringify(style));
  } catch {
    // Not worth failing a caption change over: it lasts the session.
  }
  styleListeners.forEach((listener) => listener());
};

/**
 * Whether the captions are being moved on the picture ("Move captions",
 * Ivan 2026-11-15: "move them with the mouse in an edit mode"). Never kept:
 * a film opened tomorrow does not start with its captions waiting to be
 * dragged.
 */
let isMoving = false;
const movingListeners = new Set<() => void>();

const subscribeMoving = (listener: () => void) => {
  movingListeners.add(listener);
  return () => {
    movingListeners.delete(listener);
  };
};

export const useCaptionsMoving = (): boolean =>
  useSyncExternalStore(subscribeMoving, () => isMoving);

export const setCaptionsMoving = (next: boolean): void => {
  if (next !== isMoving) {
    isMoving = next;
    movingListeners.forEach((listener) => listener());
  }
};
