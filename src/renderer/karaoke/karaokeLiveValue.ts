/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, useSyncExternalStore } from 'react';

/**
 * A reading that moves faster than the karaoke workspace can afford to render:
 * the playhead, the singer's pitch, the microphone's level.
 *
 * All three were state of the workspace, so every tick re-rendered its whole
 * tree — the playlist and each of its rows, the stage, the Maker when open —
 * forty to sixty times a second while somebody sang, and the pitch lane tore
 * its frame loop down and built it again on each one. Held here, a reading is
 * taken where it is drawn: a canvas reads it in its own frame loop, and only a
 * component that prints it subscribes, so a tick re-renders that component and
 * nothing above it.
 */
export interface IKaraokeLiveValue<T> {
  read: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface IKaraokeLiveValueWriter<T> extends IKaraokeLiveValue<T> {
  /** Heard only when it differs, the way a state setter bails out. */
  write: (next: T) => void;
}

export const createKaraokeLiveValue = <T>(
  initial: T,
): IKaraokeLiveValueWriter<T> => {
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
    write: (next) => {
      if (Object.is(next, current)) {
        return;
      }
      current = next;
      listeners.forEach((listener) => listener());
    },
  };
};

export const useKaraokeLiveValue = <T>(value: IKaraokeLiveValue<T>): T =>
  useSyncExternalStore(value.subscribe, value.read, value.read);

/**
 * `children`, drawn with the reading as it is now — and the only thing a tick
 * of it re-renders.
 *
 * A function rather than a wrapper per consumer, because the transport, the
 * chord guide, the stage's video and the Maker all take the reading as a plain
 * prop and are drawn from the workspace's own render: the function closes over
 * that render's props, so between two workspace renders a tick re-draws the
 * one child with the new reading and leaves its siblings alone.
 */
export const KaraokeLiveValue = <T>({
  value,
  children,
}: {
  value: IKaraokeLiveValue<T>;
  children: (current: T) => ReactNode;
}) => children(useKaraokeLiveValue(value));
