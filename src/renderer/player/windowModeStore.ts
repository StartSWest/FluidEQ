/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  PLAYER_HEIGHT_LIMIT_CHANNEL,
  PLAYER_WIDTH_FLOOR_CHANNEL,
  WINDOW_MODE_PARAM,
} from 'common/windowMode';
import type { IWindowState, TWindowMode } from 'common/windowMode';

/**
 * What the window is — the full app or the player — as main says it is.
 *
 * Main owns the mode, because the mode is the window's size and its limits,
 * and it is told to the page three ways: in the page's address when the
 * window opens as the player, so the first frame is already right; pushed on
 * every change; and asked for once on the first subscription, because a page
 * that reloads keeps the window it had and main's push on `did-finish-load`
 * comes before anything here is listening. One store for every reader, so
 * the shell, the switch and the player's title strip cannot disagree about
 * which one this is.
 */
interface IModeSnapshot {
  mode: TWindowMode;
  isPinned: boolean;
}

const modeInAddress = (): TWindowMode => {
  try {
    return new URLSearchParams(window.location.search).get(
      WINDOW_MODE_PARAM,
    ) === 'player'
      ? 'player'
      : 'app';
  } catch {
    // An address that cannot be read is the full app's; main's answer below
    // corrects it within a frame or two.
    return 'app';
  }
};

/**
 * The page's own record of the mode, on the document element and in its
 * address.
 *
 * The attribute is read by the stylesheet that puts the full shell away while
 * the player is up (`MiniPlayer.scss`) — the shell stays mounted, so the
 * Library's deck and the Media page's player keep playing, and only what is
 * drawn changes. The address is what a reload opens with.
 */
const markDocument = (mode: TWindowMode) => {
  document.documentElement.setAttribute('data-window-mode', mode);
  try {
    const address = new URL(window.location.href);
    if (mode === 'player') {
      address.searchParams.set(WINDOW_MODE_PARAM, 'player');
    } else {
      address.searchParams.delete(WINDOW_MODE_PARAM);
    }
    window.history.replaceState(window.history.state, '', address);
  } catch {
    // Only a reload reads the address, and main's answer corrects that too.
  }
};

let snapshot: IModeSnapshot = { mode: modeInAddress(), isPinned: false };
markDocument(snapshot.mode);
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;
/** What main was last told about the player's height, so it is told once. */
let heldHeight: number | null | undefined;
let floorHeight: number | null | undefined;
/** The same for the width its equalizer needs. */
let floorWidth: number | undefined;

const publish = (state: Partial<IWindowState> | undefined) => {
  const next: IModeSnapshot = {
    mode: state?.mode === 'player' ? 'player' : 'app',
    isPinned: state?.isPinned === true,
  };
  if (next.mode === snapshot.mode && next.isPinned === snapshot.isPinned) {
    return;
  }
  if (next.mode !== snapshot.mode) {
    markDocument(next.mode);
    // Main forgets what the player was held to when the window leaves it, so
    // the next player has to say it again even if it comes to the same number.
    heldHeight = undefined;
    floorHeight = undefined;
    floorWidth = undefined;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!stopListening) {
    const bridge = window.electron?.ipcRenderer;
    if (bridge) {
      stopListening = bridge.on('window-state-changed', (...args: unknown[]) =>
        publish(args[0] as Partial<IWindowState> | undefined),
      );
      bridge
        .getWindowState()
        .then(publish)
        // The mode is what is drawn, and a main that is restarting answers
        // nothing; its push on the next load is the answer.
        .catch(() => undefined);
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopListening) {
      stopListening();
      stopListening = undefined;
    }
  };
};

const getSnapshot = () => snapshot;

/** The window's mode and the player's Always on top, kept current. */
export const useWindowMode = (): IModeSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot);

/**
 * How the two modes trade places: the window darkens, changes size and
 * comes back up (Ivan, 2026-09-21).
 *
 * Short on purpose — the switch has to feel like one press, not a scene
 * change — and driven by the animations' own finish rather than by any
 * clock: the window is asked to change size only once the page is out, and
 * the page comes back on the frame after the new mode has been drawn.
 */
const FADE_OUT_MS = 110;
const FADE_IN_MS = 170;

/** The fade-out, held at nothing while the window changes size. */
let held: Animation | undefined;

const canFade = () =>
  typeof document !== 'undefined' &&
  typeof document.body?.animate === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fadeOut = () => {
  if (!canFade()) {
    return Promise.resolve();
  }
  held?.cancel();
  held = document.body.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: FADE_OUT_MS,
    easing: 'ease-in',
    fill: 'forwards',
  });
  // A cancelled animation rejects; either way the switch carries on.
  return held.finished.catch(() => undefined);
};

const fadeIn = () =>
  new Promise<void>((resolve) => {
    if (!canFade()) {
      held?.cancel();
      held = undefined;
      resolve();
      return;
    }
    // The frame after the new mode has been laid out, so what comes up is
    // the new view and not the old one at its new size.
    requestAnimationFrame(() => {
      const rise = document.body.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: FADE_IN_MS,
        easing: 'ease-out',
      });
      // Let go of the hold only once the rise is running, or the page is
      // fully lit for the frame between the two.
      held?.cancel();
      held = undefined;
      rise.finished.catch(() => undefined).then(() => resolve());
    });
  });

/**
 * Ask main for the other mode. What the page draws follows main's answer,
 * never the request: in full screen the switch is refused. Main answers once
 * the window has the new mode's size, and the page is dark for the change.
 */
export const setWindowMode = async (mode: TWindowMode): Promise<void> => {
  await fadeOut();
  try {
    const answered = await window.electron.ipcRenderer.setWindowMode(mode);
    publish({ ...snapshot, mode: answered });
  } finally {
    await fadeIn();
  }
};

/** The player's Always on top. */
export const setWindowPinned = (isPinned: boolean): Promise<void> =>
  window.electron.ipcRenderer
    .setWindowPinned(isPinned)
    .then(() => publish({ ...snapshot, isPinned }));

/**
 * The player's window height, in this page's CSS pixels — a deck opening or
 * closing, or the player folding to one line and back.
 */
export const resizePlayerWindow = (cssHeight: number): Promise<void> =>
  window.electron.ipcRenderer.resizePlayerWindow(Math.round(cssHeight));

/**
 * What the player's window may do about its height: the one it is held to,
 * and the least it may be. Either may be `null` for "no limit".
 *
 * While nothing in the player can grow it is exactly as tall as its decks,
 * and main holds it there; whatever is open, it is never shorter than that
 * content needs, because the player has no scrollbar to reach the rest
 * with. The page cannot resize a window itself, and the limits are what
 * keep the listener's own drag of the edge honest too. Said only when they
 * change: the page measures its decks on every frame of a width drag and
 * the heights they come to change far less often.
 */
export const holdPlayerHeight = (
  cssHeight: number | null,
  cssFloor: number | null,
) => {
  const held = cssHeight === null ? null : Math.ceil(cssHeight);
  const floor = cssFloor === null ? null : Math.ceil(cssFloor);
  if (held === heldHeight && floor === floorHeight) {
    return;
  }
  heldHeight = held;
  floorHeight = floor;
  window.electron?.ipcRenderer.sendMessage(PLAYER_HEIGHT_LIMIT_CHANNEL, [
    held,
    floor,
  ]);
};

/**
 * The width the player's equalizer needs, under which the window may not be
 * dragged: the band layout decides it (`playerWidthForBands`), so it changes
 * only when the listener chooses another one.
 */
export const floorPlayerWidth = (cssWidth: number) => {
  const next = Math.ceil(cssWidth);
  if (next === floorWidth) {
    return;
  }
  floorWidth = next;
  window.electron?.ipcRenderer.sendMessage(PLAYER_WIDTH_FLOOR_CHANNEL, [next]);
};
