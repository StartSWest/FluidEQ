/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library player tells the window, sent once per change: `settle`
 * runs after every press and every clock reading, and most of those leave
 * the view as it was. A window that asks again (it was reloaded, or came
 * back into sight) is sent both whatever they hold.
 */
import type { ILibraryPlayerWindow } from './libraryPlayerTypes';
import {
  type IPlayerSnapshot,
  clockKey,
  playerViewOf,
  publishedClockOf,
} from './playerView';

export interface IViewSender {
  view: (force?: boolean) => void;
  clock: (force?: boolean) => void;
}

const createViewSender = (
  window: ILibraryPlayerWindow,
  snapshot: () => IPlayerSnapshot,
): IViewSender => {
  let sentView = '';
  let sentClock = '';
  return {
    view: (force = false) => {
      const current = playerViewOf(snapshot());
      const key = JSON.stringify(current);
      if (force || key !== sentView) {
        sentView = key;
        window.view(current);
      }
    },
    clock: (force = false) => {
      const published = publishedClockOf(snapshot());
      const key = clockKey(published);
      if (force || key !== sentClock) {
        sentClock = key;
        window.clock(published);
      }
    },
  };
};

export default createViewSender;
