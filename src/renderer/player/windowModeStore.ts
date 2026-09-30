/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  PLAYER_AMP_CHANNEL,
  PLAYER_HEIGHT_LIMIT_CHANNEL,
  PLAYER_WIDTH_FLOOR_CHANNEL,
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_MODE_PARAM,
  WINDOW_REVEAL_CHANNEL,
} from 'common/windowMode';
import type { IWindowState, TPlayerAmp, TWindowMode } from 'common/windowMode';

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
/** Which amp main was last told the player is. */
let reportedAmp: TPlayerAmp | undefined;

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
 * How the two modes trade places. On Windows the window leaves the screen
 * whole, changes size out of sight and comes back as the other mode, drawn
 * (Ivan, 2026-09-22: "first we hide the mini app completely then we show the
 * full ui"). Elsewhere the page darkens, the window changes size and the page
 * comes back up (2026-09-21).
 *
 * Driven by events rather than by any clock either way: the window is asked
 * to change size only once the old view is gone, and the new one shows only
 * once the page has drawn it at the window's new size.
 */
const FADE_OUT_MS = 110;
const FADE_IN_MS = 170;

/** The fade-out, held at nothing while the window changes size. */
let held: Animation | undefined;

/**
 * Which change of amp is the newest (`handOverAmp`). One that finds a newer
 * change begun — another change of amp, or a switch of mode — leaves the
 * window to it: bringing it back as well would show the newer one half done.
 */
let ampChange = 0;

/** Whether the page can be held dark at all: not in a test's document. */
const canHold = () =>
  typeof document !== 'undefined' &&
  typeof document.body?.animate === 'function';

/**
 * How long each half takes. With reduced motion, no time at all — the page
 * still goes dark for the change of size and comes back, without travelling
 * there, because the stretch the dark hides is not motion anybody chose.
 */
const fadeTime = (ms: number) =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;

/** Resolves once a frame has been drawn after this moment: two frames on. */
export const afterNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/**
 * Marks the switch on the document for as long as it runs: the page's canvas
 * wears the window's floor meanwhile (`App.scss`).
 */
const markSwitching = (isSwitching: boolean) => {
  document.documentElement.toggleAttribute(
    'data-window-switching',
    isSwitching,
  );
};

const fadeOut = async () => {
  if (!canHold()) {
    return;
  }
  markSwitching(true);
  held?.cancel();
  held = document.body.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: fadeTime(FADE_OUT_MS),
    easing: 'ease-in',
    fill: 'forwards',
  });
  // A cancelled animation rejects; either way the switch carries on.
  await held.finished.catch(() => undefined);
  // And on screen before the window changes size. The fade ends a frame or
  // two before its last frame is shown, and a window resized in between kept
  // the old view, part-faded, in its corner while the new one came up (Ivan,
  // 2026-09-22: "I can see a mini player frame on the left for a sec").
  await afterNextFrame();
};

/** Resolves on the window's next `resize`. */
const nextResize = () =>
  new Promise<void>((resolve) => {
    window.addEventListener('resize', () => resolve(), { once: true });
  });

/**
 * Resolves once this page's viewport is the window's content — the size main
 * has just given the window — within a pixel for the zoom's rounding.
 *
 * Main answers a switch the moment the window has its new size, but the page
 * hears of that size separately and later, and until it draws a frame at the
 * new size the screen shows its last frame stretched to fit the new window.
 * The page used to come back one frame after the answer: into that frame,
 * still at the old size (Ivan, 2026-09-22: "I can see the ui stretched not
 * fitting and I see how it stretched back to fit"). Asked again after every
 * resize, so a window that changes twice — restored, then maximised — is
 * waited out rather than caught halfway.
 */
export const untilViewportIsWindow = async (): Promise<void> => {
  const bridge = window.electron?.ipcRenderer;
  if (typeof bridge?.getWindowState !== 'function') {
    return;
  }
  // A main that is restarting answers nothing; the page comes back up.
  const state = await bridge.getWindowState().catch(() => undefined);
  const size = state?.contentSize;
  // A main from before `contentSize` gives nothing to wait on.
  if (!state || !size) {
    return;
  }
  const zoom = state.zoom > 0 ? state.zoom : 1;
  if (
    Math.abs(window.innerWidth - size.width / zoom) <= 1 &&
    Math.abs(window.innerHeight - size.height / zoom) <= 1
  ) {
    return;
  }
  await nextResize();
  await untilViewportIsWindow();
};

/** The page brought back up out of the hold. */
const rise = async () => {
  const rising = document.body.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: fadeTime(FADE_IN_MS),
    easing: 'ease-out',
  });
  // Let go of the hold only once the rise is running, or the page is fully
  // lit for the frame between the two.
  held?.cancel();
  held = undefined;
  await rising.finished.catch(() => undefined);
  markSwitching(false);
};

const fadeIn = async () => {
  if (!canHold()) {
    return;
  }
  // Only once the page has drawn the new mode at the window's new size, so
  // the first frame to show is that one and not the stretched one before it.
  await untilViewportIsWindow();
  await afterNextFrame();
  await rise();
};

/**
 * Whether main takes the window off the screen for the switch: on Windows,
 * where it is cloaked — gone from view and still drawing (`windowDwm.ts`).
 */
export const hidesWindow = () =>
  window.electron?.platform === 'win32' &&
  typeof window.electron.ipcRenderer?.sendMessage === 'function';

/**
 * Ask main for the other mode. What the page draws follows main's answer,
 * never the request: in full screen the switch is refused. Main answers once
 * the window has the new mode's size.
 *
 * The window goes before the question is asked — main hears the two in the
 * order they are sent — and comes back, in a `finally`, whatever the answer:
 * a switch refused or failed must not leave it off the screen.
 */
export const setWindowMode = async (mode: TWindowMode): Promise<void> => {
  // Any change of amp still coming back is this switch's now: it brings the
  // window back itself, drawn as the other mode.
  ampChange += 1;
  const isHidden = hidesWindow();
  if (isHidden) {
    window.electron.ipcRenderer.sendMessage(WINDOW_HIDE_FOR_SWITCH_CHANNEL, []);
  } else {
    await fadeOut();
  }
  try {
    const answered = await window.electron.ipcRenderer.setWindowMode(mode);
    publish({ ...snapshot, mode: answered });
  } finally {
    if (isHidden) {
      await untilViewportIsWindow();
      await afterNextFrame();
      window.electron.ipcRenderer.sendMessage(WINDOW_REVEAL_CHANNEL, []);
    } else {
      await fadeIn();
    }
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

/**
 * Which amp the player is, told to main whenever it changes, in either mode,
 * so the window opens at that amp's own size and moves to it when the amp
 * changes under it (`setAmp`). Main forgets the height and width the old amp
 * held the window to, so the new one has to say them again even where they
 * come to the same numbers.
 */
export const reportPlayerAmp = (amp: TPlayerAmp) => {
  if (amp === reportedAmp) {
    return;
  }
  reportedAmp = amp;
  heldHeight = undefined;
  floorHeight = undefined;
  floorWidth = undefined;
  window.electron?.ipcRenderer.sendMessage(PLAYER_AMP_CHANNEL, [amp]);
};

/**
 * The window back on the screen once the new amp is drawn at its size — in a
 * `finally`, as the switch of mode does, because nothing may leave it hidden —
 * unless a newer change has begun, which brings it back itself.
 */
const comeBackAsAmp = async (change: number, isHidden: boolean) => {
  const isNewest = () => change === ampChange;
  try {
    if (isHidden) {
      // Main hears the page in order, so once it has answered a question
      // asked after the hide the window is off the screen, and the page can
      // let go of its own hold and draw the new amp there.
      await window.electron.ipcRenderer.getWindowState().catch(() => undefined);
      if (!isNewest()) {
        return;
      }
      held?.cancel();
      held = undefined;
      markSwitching(false);
    } else if (!canHold()) {
      return;
    }
    await untilViewportIsWindow();
    await afterNextFrame();
  } finally {
    if (isNewest() && isHidden) {
      window.electron.ipcRenderer.sendMessage(WINDOW_REVEAL_CHANNEL, []);
    } else if (isNewest() && canHold()) {
      await rise();
    }
  }
};

/**
 * One amp giving way to the other out of sight, the way the full app and the
 * amp trade places (Ivan, 2026-09-28: "hide one completely and then show the
 * other when ready, similar to what we do for full vs amp"). The window colours
 * turned to the Backdrop, or a Plus look picked or left in it, changes the amp
 * and the window's size at once, and in view that was the new amp drawn at the
 * old amp's size, then stretched to the new one, then laid out again.
 *
 * Called in the layout pass that put the new amp in, BEFORE it is painted —
 * what the listener picked has already changed the picture behind the amp in
 * the same pass, so there is no moment before it to hide in. The page is held
 * at nothing on the spot, so its first frame is the window's floor whatever
 * else happens; on Windows the window then leaves the screen whole and the
 * page draws the new amp there; everywhere it comes back once the page has
 * drawn the new amp at the window's new size (`comeBackAsAmp`). Main moves the
 * window to the new amp's own bounds when it hears which amp this is
 * (`reportPlayerAmp`), which is sent after the hide so it happens out of sight.
 */
export const handOverAmp = (amp: TPlayerAmp) => {
  ampChange += 1;
  const change = ampChange;
  const isHidden = hidesWindow();
  if (canHold()) {
    markSwitching(true);
    held?.cancel();
    held = document.body.animate([{ opacity: 0 }, { opacity: 0 }], {
      duration: 0,
      fill: 'forwards',
    });
  }
  if (isHidden) {
    window.electron.ipcRenderer.sendMessage(WINDOW_HIDE_FOR_SWITCH_CHANNEL, []);
  }
  reportPlayerAmp(amp);
  comeBackAsAmp(change, isHidden).catch(() => undefined);
};
