/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * The full screen's pins: whether the header and the transport stay on screen
 * or come and go with the pointer. Pressed from the three icons that end every
 * page's options row (`FullScreenToggles`), and read by the shell to lay the
 * window out. Not persisted, like the graph modes they sit beside.
 */
interface IPin {
  toggle: () => void;
  subscribe: (listener: () => void) => () => void;
  read: () => boolean;
}

const createPin = (initial: boolean): IPin => {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    toggle: () => {
      value = !value;
      listeners.forEach((listener) => listener());
    },
    subscribe,
    read: () => value,
  };
};

const noPin = () => false;

/**
 * Whether full screen keeps FluidEQ's own header, over the graph, the
 * Karaoke's stage and the Studio's. On by default: a picture with the app's
 * header across it is still the app.
 */
const stageTopBar = createPin(true);
export const toggleFullScreenTopBar = stageTopBar.toggle;
export const useFullScreenTopBar = () =>
  useSyncExternalStore(stageTopBar.subscribe, stageTopBar.read, noPin);

/**
 * The same over a film, the Library's or Online Media's, which keeps its own
 * pin, off by default: a film's full screen is the picture alone (Ivan,
 * 2026-11-15: "it is a video full screen so don't show the app header").
 * The pin is on the film's own row like every other page's (2026-11-16: "the
 * same base bar for all the screens"), so pinning it there is a choice made
 * for films and leaves the stage's as it was.
 */
const filmTopBar = createPin(false);
export const toggleFilmFullScreenTopBar = filmTopBar.toggle;
export const useFilmFullScreenTopBar = () =>
  useSyncExternalStore(filmTopBar.subscribe, filmTopBar.read, noPin);

/**
 * Whether full screen keeps the transport on screen, pinned, rather than
 * letting it go with the pointer at rest (Ivan, 2026-11-16: "the icons to pin
 * the header and all ... in full screen"). Off by default: the bar comes from
 * the bottom edge and goes after three still seconds. One pin for every page:
 * the transport is the same bar on all of them.
 */
const bottomBar = createPin(false);
export const toggleFullScreenBottomBar = bottomBar.toggle;
export const useFullScreenBottomBar = () =>
  useSyncExternalStore(bottomBar.subscribe, bottomBar.read, noPin);
