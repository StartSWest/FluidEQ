/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useSyncExternalStore } from 'react';

/** Anything read now and told about when it changes. */
export interface IReadableStore<T> {
  read: () => T;
  subscribe: (listener: () => void) => () => void;
}

/**
 * What a component makes of a fast reading, re-rendering it only when that
 * changes: whether the output clipped rather than the meter's levels, which
 * move thirty times a second while the answer moves a few times a song.
 *
 * `select` may be a new function on every render, closing over that render's
 * props; it is asked again when it or the reading changes, and an answer
 * `isEqual` to the last one hands back the last one, so React sees nothing
 * new.
 */
export const useStoreSelector = <T, S>(
  store: IReadableStore<T>,
  select: (current: T) => S,
  isEqual: (previous: S, next: S) => boolean = Object.is,
): S => {
  const lastRef = useRef<{
    input: T;
    select: (current: T) => S;
    output: S;
  }>(undefined);
  const snapshot = () => {
    const input = store.read();
    const last = lastRef.current;
    if (last && last.select === select && Object.is(last.input, input)) {
      return last.output;
    }
    const next = select(input);
    const output = last && isEqual(last.output, next) ? last.output : next;
    lastRef.current = { input, select, output };
    return output;
  };
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
};

/**
 * `listener` handed every reading as it arrives, and the one there is now when
 * it starts listening, without rendering anything: for a drawing that takes
 * its targets from the reading and moves towards them in its own frames.
 *
 * Read through a ref, so a listener that is a new function every render does
 * not unsubscribe and subscribe again on each one.
 */
export const useStoreListener = <T>(
  store: IReadableStore<T>,
  listener: (current: T) => void,
) => {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    listenerRef.current(store.read());
    return store.subscribe(() => listenerRef.current(store.read()));
  }, [store]);
};
