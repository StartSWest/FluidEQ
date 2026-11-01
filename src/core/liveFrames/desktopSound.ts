/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISystemSound } from '../systemSound/systemSound';
import {
  createDesktopFrameReader,
  type IDesktopFrame,
  type IDesktopFrameReader,
} from './desktopFrames';

/**
 * The music the desktop backgrounds move to, heard by the core.
 *
 * They used to be fed by the window: main asked it for every frame, and the
 * window kept a capture of Chromium's open behind a minimise to answer — the
 * whole app page, its graphics and Chromium's 66 MB capture process kept
 * awake for a background on the desktop. The core hears the output itself
 * now, only while a background follows the music, and makes each frame
 * where it is asked for one.
 *
 * Until it cannot: a platform with no way to hear the output, or a helper
 * that failed, gives the job back to the window, which answers as it always
 * did (`serves`). It is tried again when the output changes, which is the
 * one thing that can make it hear where it could not — never on a timer.
 */
export interface IDesktopSound {
  /** Whether any background is following the music now. */
  want(wanted: boolean): void;
  /** Windows moved the default output: worth hearing again. */
  outputChanged(): void;
  /**
   * Whether the core answers the backgrounds; when it does not, the window
   * has to. True from the start, so nothing is opened twice before the first
   * background has even asked.
   */
  serves(): boolean;
  /** The newest frame; silence until the first block is heard. */
  read(): IDesktopFrame;
  /** Called with `serves()` whenever it changes. */
  onServesChanged(listener: (serves: boolean) => void): () => void;
}

export const createDesktopSound = (
  systemSound: ISystemSound,
): IDesktopSound => {
  const listeners = new Set<(serves: boolean) => void>();
  let wanted = false;
  let gaveUp = false;
  let reader: IDesktopFrameReader = createDesktopFrameReader();
  let stopListening: (() => void) | undefined;

  const say = () => {
    const now = !gaveUp;
    listeners.forEach((listener) => listener(now));
  };

  const listen = () => {
    if (!wanted || gaveUp || stopListening) {
      return;
    }
    // A new run is a new history: what was heard before it is not the music
    // now, and the track reference starts again, as the window's does.
    const heard = createDesktopFrameReader();
    reader = heard;
    let isCurrent = true;
    const stop = systemSound.listen({
      ready: () => undefined,
      audio: (block) => heard.analyser.push(block),
      lost: () => {
        if (!isCurrent) {
          return;
        }
        isCurrent = false;
        stopListening = undefined;
        gaveUp = true;
        say();
      },
    });
    // `lost` may come inside `listen` itself, where no hearing exists.
    if (isCurrent) {
      stopListening = () => {
        isCurrent = false;
        stop();
      };
    }
  };

  return {
    want: (next) => {
      wanted = next;
      if (wanted) {
        listen();
        return;
      }
      stopListening?.();
      stopListening = undefined;
    },
    outputChanged: () => {
      if (!gaveUp) {
        return;
      }
      gaveUp = false;
      say();
      listen();
    },
    serves: () => !gaveUp,
    read: () => reader.read(),
    onServesChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
