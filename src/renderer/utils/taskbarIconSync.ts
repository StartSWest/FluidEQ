/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log/renderer';
import type { TTaskbarIconRequest } from 'common/taskbarIcon';
import { LAGOON_SKY } from './rainbowPalette';
import type { ISceneSky } from './sceneTint';
import { getShownSceneSky } from './sceneTintStore';
import {
  drawTaskbarIcons,
  readTaskbarIconColours,
  type ITaskbarIconColours,
} from './taskbarIconArt';
import {
  DEFAULT_SHADE,
  getThemeShade,
  subscribeRoot,
  subscribeTheme,
} from './theme';

/**
 * Keeps the taskbar button in the window's colours (`taskbarIconArt.ts`,
 * `main/taskbarIcon.ts`).
 *
 * THE INSTALLED ICON WHILE THE WINDOW WEARS THE APP'S OWN COLOURS: Lagoon,
 * lent with no Tint and no visualizer or Studio project lending theirs
 * (`SceneTint.tsx`), at a new install's Brightness. That is the window as it
 * ships, and its button keeps the icon a pinned shortcut shows. Anything
 * else — a Tint, a visualizer's colours, Brightness moved — is drawn.
 */
export const isStockTaskbarIcon = (
  sky: ISceneSky | undefined,
  shade: number,
): boolean => sky === LAGOON_SKY && shade === DEFAULT_SHADE;

/** What the window would ask for now: a key to compare, and the ask. */
export interface ITaskbarIconReading {
  /** The same text for the same icon: compared before anything is drawn. */
  key: string;
  request: () => TTaskbarIconRequest;
}

/** The reading for a window in these colours. */
export const taskbarIconReading = (
  isStock: boolean,
  colours: ITaskbarIconColours | undefined,
  draw: (colours: ITaskbarIconColours) => TTaskbarIconRequest,
): ITaskbarIconReading | undefined => {
  if (isStock) {
    return { key: 'stock', request: () => ({ kind: 'stock' }) };
  }
  if (!colours) {
    return undefined;
  }
  return {
    key: `${colours.tile.join(' ')}|${colours.logo.join(' ')}`,
    request: () => draw(colours),
  };
};

export interface ITaskbarIconSyncDeps {
  read: () => ITaskbarIconReading | undefined;
  /** Sets the icon; settles once it is set. */
  send: (request: TTaskbarIconRequest) => Promise<void>;
  /** Runs `work` once, before the next frame is painted. */
  schedule: (work: () => void) => void;
  onError: (error: unknown) => void;
}

/**
 * Change by change, at most one icon a frame, and one set at a time.
 *
 * A Tint dragged or a visualizer's colours fading in changes the window's
 * colours on every frame, and each change says so. The first change books
 * the next frame and the rest wait for it, which then reads the colours as
 * they are by then: the latest, once. A frame whose colours give the icon
 * already on the button sends nothing. And while one set is on its way to
 * main nothing else is sent: the frame that finds one in flight leaves a
 * note, and the answer books another frame, so the button always ends on the
 * last colours and the disk never sees more than one write at a time.
 */
export const createTaskbarIconSync = ({
  read,
  send,
  schedule,
  onError,
}: ITaskbarIconSyncDeps) => {
  let shownKey: string | undefined;
  let isBooked = false;
  let isSending = false;
  let changedWhileSending = false;
  let isStopped = false;

  const changed = () => {
    if (isBooked || isStopped) {
      return;
    }
    isBooked = true;
    schedule(() => {
      isBooked = false;
      if (isStopped) {
        return;
      }
      if (isSending) {
        changedWhileSending = true;
        return;
      }
      const reading = read();
      if (!reading || reading.key === shownKey) {
        return;
      }
      isSending = true;
      shownKey = reading.key;
      send(reading.request())
        .catch((error: unknown) => {
          // Not on the button after all: the next change tries again.
          shownKey = undefined;
          onError(error);
        })
        .finally(() => {
          isSending = false;
          if (changedWhileSending) {
            changedWhileSending = false;
            changed();
          }
        });
    });
  };

  return {
    changed,
    stop: () => {
      isStopped = true;
    },
  };
};

/**
 * Starts the sync on this window: the first icon now, then one per change of
 * the root's colours or of Brightness. Returns the teardown.
 */
export const startTaskbarIconSync = (
  send: (request: TTaskbarIconRequest) => Promise<void>,
): (() => void) => {
  const sync = createTaskbarIconSync({
    read: () =>
      taskbarIconReading(
        isStockTaskbarIcon(getShownSceneSky(), getThemeShade()),
        readTaskbarIconColours(),
        (colours) => ({ kind: 'drawn', images: drawTaskbarIcons(colours) }),
      ),
    send,
    // A minimised window paints no frames, and its taskbar button is the
    // one part of it still on screen: there the work runs once the task that
    // changed the colours is done, which still folds a burst into one.
    schedule: (work) => {
      if (document.hidden) {
        queueMicrotask(work);
      } else {
        requestAnimationFrame(work);
      }
    },
    onError: (error) =>
      log.error('Could not set the taskbar icon in the window colours', error),
  });
  const stopRoot = subscribeRoot(sync.changed);
  const stopTheme = subscribeTheme(sync.changed);
  sync.changed();
  return () => {
    sync.stop();
    stopRoot();
    stopTheme();
  };
};
