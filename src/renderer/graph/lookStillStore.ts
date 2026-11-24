/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The look picker's still pictures of the standard looks, kept for the
 * session, and whose turn it is to paint one (`LookStillPainter`).
 *
 * A still is the real look, drawn by the graph's own renderer against the
 * demo song, so each one costs a few seconds of song played offline and a
 * drawing per frame of it. Painted once per look and colours, and kept as a
 * compressed picture rather than a canvas: forty tiles' backing stores were
 * several megabytes held for a menu that is mostly closed. Painted one at a
 * time across the window, never forty at once, and only while the window is
 * shown - a hidden window draws nothing, and a still painted then would be
 * a blank one kept for the session.
 */

export interface ILookStill {
  /** The picture, as an object URL the cache owns. */
  url: string;
  /** The CSS width it was drawn at, to tell a tile grown past it. */
  width: number;
}

/**
 * How many stills are kept: every look in two sets of colours and two
 * sizes, past which the oldest goes. The URLs are revoked as they go.
 */
const KEPT = 200;

const stills = new Map<string, ILookStill>();
const stillListeners = new Set<() => void>();

const subscribeStills = (listener: () => void) => {
  stillListeners.add(listener);
  return () => {
    stillListeners.delete(listener);
  };
};

/** The still kept for `key`, re-rendering when one arrives. */
export const useLookStill = (key: string): ILookStill | undefined =>
  useSyncExternalStore(subscribeStills, () => stills.get(key));

/** Keeps `still` for `key`, letting the oldest go past `KEPT`. */
export const keepLookStill = (key: string, still: ILookStill): void => {
  const replaced = stills.get(key);
  if (replaced) {
    URL.revokeObjectURL(replaced.url);
    stills.delete(key);
  }
  stills.set(key, still);
  while (stills.size > KEPT) {
    const [oldest] = stills;
    URL.revokeObjectURL(oldest[1].url);
    stills.delete(oldest[0]);
  }
  stillListeners.forEach((listener) => listener());
};

/**
 * Whether no still can be had this session: no demo song, or no offline
 * audio to play it in. The tiles show their icons then, rather than an
 * empty plate waiting for a picture that will not come.
 */
let unavailable = false;

export const markLookStillsUnavailable = (): void => {
  if (!unavailable) {
    unavailable = true;
    stillListeners.forEach((listener) => listener());
  }
};

export const useLookStillsUnavailable = (): boolean =>
  useSyncExternalStore(subscribeStills, () => unavailable);

/** The tiles waiting to paint, the one painting first. */
const queue: symbol[] = [];
const turnListeners = new Set<() => void>();
let watchingVisibility = false;

const notifyTurn = () => turnListeners.forEach((listener) => listener());

const subscribeTurn = (listener: () => void) => {
  turnListeners.add(listener);
  if (!watchingVisibility && typeof document !== 'undefined') {
    watchingVisibility = true;
    document.addEventListener('visibilitychange', notifyTurn);
  }
  return () => {
    turnListeners.delete(listener);
    if (turnListeners.size === 0 && watchingVisibility) {
      watchingVisibility = false;
      document.removeEventListener('visibilitychange', notifyTurn);
    }
  };
};

const leave = (token: symbol) => {
  const at = queue.indexOf(token);
  if (at >= 0) {
    queue.splice(at, 1);
    notifyTurn();
  }
};

/**
 * Whether it is this tile's turn to paint its still, waiting in line while
 * `wanted`. `done` gives the turn to the next tile; leaving the line (not
 * wanted any more, or unmounted) does too.
 */
export const useStillTurn = (wanted: boolean) => {
  const [token] = useState(() => Symbol('look still'));
  useEffect(() => {
    if (!wanted) {
      return undefined;
    }
    queue.push(token);
    notifyTurn();
    return () => leave(token);
  }, [token, wanted]);
  const mine = useSyncExternalStore(
    subscribeTurn,
    () => queue[0] === token && !document.hidden,
  );
  return { mine, done: () => leave(token) };
};
