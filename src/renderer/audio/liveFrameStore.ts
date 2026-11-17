/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IChartPointData } from '../graph/ChartController';
import type { IOutputLevel } from '../graph/outputLevel';

/**
 * What the capture publishes with every block of audio it hears: the
 * spectrum's points, the graphs' own, the waveform, the meter and whether
 * anything clipped.
 */
export interface ILiveAudioFrame {
  graphPoints: IChartPointData[];
  isClipping: boolean;
  outputLevels: IOutputLevel[];
  points: IChartPointData[];
  waveform: number[];
}

/**
 * The frames, held outside React and read where they are drawn.
 *
 * They were state of the provider at the top of the window, five setters
 * called on every block of audio - about thirty a second - so every block
 * rendered the provider, the one under it that shares this computer's sound,
 * and every component that read a frame, whether it printed one or only
 * handed it to a canvas. Measured in the running window with music playing
 * (240 Hz, 2026-11-16): 83 React commits a second, the provider and its
 * neighbour 31 renders a second each, the titlebar wave 59, the meter 31.
 * A drawing now subscribes and is handed each frame without rendering; only
 * something that prints a reading renders, and only when what it prints
 * changes (`useLiveAudioFrameSelector`).
 */
export interface ILiveFrameStore {
  /** The frame as it is now. A new object only when something in it changed. */
  read: () => ILiveAudioFrame;
  subscribe: (listener: () => void) => () => void;
}

export interface ILiveFrameStoreWriter extends ILiveFrameStore {
  /**
   * Publish what this block changed, all at once: one notification however
   * many of the frame's parts moved, and none when nothing did.
   */
  publish: (patch: Partial<ILiveAudioFrame>) => void;
}

const isUnchanged = (
  current: ILiveAudioFrame,
  patch: Partial<ILiveAudioFrame>,
) =>
  (Object.keys(patch) as (keyof ILiveAudioFrame)[]).every((key) =>
    Object.is(current[key], patch[key]),
  );

export const createLiveFrameStore = (
  initial: ILiveAudioFrame,
): ILiveFrameStoreWriter => {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (patch) => {
      if (isUnchanged(current, patch)) {
        return;
      }
      current = { ...current, ...patch };
      listeners.forEach((listener) => listener());
    },
  };
};

/**
 * The local capture's frames with a remote sender's laid over them while one
 * is sending: its spectrum and waveform replace this computer's everywhere,
 * so nothing draws the wrong music.
 */
export interface IVisibleFrameStore extends ILiveFrameStore {
  /** What the sender sent last; undefined while nobody is sending. */
  setSender: (sender: Partial<ILiveAudioFrame> | undefined) => void;
}

export const createVisibleFrameStore = (
  local: ILiveFrameStore,
): IVisibleFrameStore => {
  let sender: Partial<ILiveAudioFrame> | undefined;
  // The merge is cached by what it was made from, so a reader that asks twice
  // between two frames - `useSyncExternalStore` does - is handed one object.
  let merged:
    | {
        local: ILiveAudioFrame;
        sender: Partial<ILiveAudioFrame>;
        frame: ILiveAudioFrame;
      }
    | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  // The local store is listened to only while somebody listens here.
  let unsubscribeLocal: (() => void) | undefined;
  return {
    read: () => {
      const frame = local.read();
      if (!sender) {
        return frame;
      }
      if (merged?.local !== frame || merged.sender !== sender) {
        merged = { local: frame, sender, frame: { ...frame, ...sender } };
      }
      return merged.frame;
    },
    subscribe: (listener) => {
      if (listeners.size === 0) {
        unsubscribeLocal = local.subscribe(notify);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeLocal?.();
          unsubscribeLocal = undefined;
        }
      };
    },
    setSender: (next) => {
      if (next === sender) {
        return;
      }
      sender = next;
      merged = undefined;
      notify();
    },
  };
};
