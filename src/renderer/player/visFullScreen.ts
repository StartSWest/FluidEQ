/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WINDOW_HIDE_FOR_SWITCH_CHANNEL,
  WINDOW_REVEAL_CHANNEL,
} from 'common/windowMode';
import { setPlayerVisFull } from './playerLayout';
import {
  afterNextFrame,
  hidesWindow,
  untilViewportIsWindow,
} from './windowModeStore';

/**
 * THE PLAYER'S PICTURE ONTO THE WHOLE SCREEN AND BACK, WITHOUT THE SNAP.
 *
 * It snapped: the decks vanished inside the small window, and for the frames
 * between the window changing size and the page drawing at the new size
 * Windows showed the player's last frame stretched over the whole screen.
 *
 * As Ivan set it (2026-09-24: "just hide player switch to full screen no
 * resize the fade in there then when back close full screen and then appear
 * the player"): in, the window leaves the screen whole (cloaked, the way the
 * switch between the app and the player does it), goes full screen out of
 * sight, and comes back black with the picture fading in over it. Out, the
 * window leaves the screen, leaves full screen, and comes back as the player,
 * drawn. A picture that grew out of its deck and shrank back into it was
 * built first and taken out ("dont make that transition").
 *
 * Every step waits on the thing it needs — main's answer, the page reaching
 * the size main reports for the window, a frame drawn, the fade finishing —
 * never on a clock, and never on arithmetic about the screen, which a display
 * scale can round a pixel away from the window and leave the wait unanswered
 * with the window off the screen. A Mac animates a window into full screen
 * itself, in a space of its own, so there the picture only switches.
 */

const FADE_IN_MS = 320;

const time = (ms: number) =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;

/**
 * Asks the window, and says whether it is now as asked. Main has moved it by
 * the time it answers (`windowModes.setFullScreen`); a full screen the
 * listener chose from the system is not the page's to end, and answers "still
 * full screen" (`fullScreenOwner.ts`).
 */
const askWindow = async (next: boolean): Promise<boolean> =>
  (await window.electron.ipcRenderer.setWindowFullScreen(next)) === next;

/**
 * The window off the screen, and the way to put it back. On Windows it is
 * cloaked — gone from view and still drawing (`windowDwm.ts`); elsewhere the
 * page goes black. Main handles messages in the order they are sent, so the
 * window is off the screen before it is asked to change size.
 */
const offScreen = (root: HTMLElement) => {
  if (hidesWindow()) {
    window.electron.ipcRenderer.sendMessage(WINDOW_HIDE_FOR_SWITCH_CHANNEL, []);
    return () =>
      window.electron.ipcRenderer.sendMessage(WINDOW_REVEAL_CHANNEL, []);
  }
  const black = root.animate([{ filter: 'brightness(0)' }], {
    duration: 0,
    fill: 'forwards',
  });
  return () => black.cancel();
};

/** One change at a time: a press during one is ignored. */
let isChanging = false;

const enter = async (root: HTMLElement) => {
  const reveal = offScreen(root);
  // A black cover over the picture, from the first frame of the full-screen
  // layout on, lifted once the window is back — so whatever shows before is
  // black and the picture fades in under it. A cover and not the picture's
  // own opacity: every drawing loop here stops while its box is transparent
  // (`observeShown`), and an animation of the Web Animations API raises no
  // event it listens for, so a picture faded in by its own opacity stayed
  // stopped — a standard visualizer came up frozen (Ivan, 2026-09-24: "the
  // standard viz in fullscreen not showing only a freezed thing").
  const cover = document.createElement('div');
  cover.className = 'mini-player__cover';
  // Refused, or anything failing on the way: the player as it was, in view.
  // A cover or a cloak left behind is a black window, or no window at all.
  const giveBack = () => {
    setPlayerVisFull(false);
    cover.remove();
    reveal();
  };
  try {
    root.appendChild(cover);
    // Before the window is asked: the state it announces must find the claim.
    setPlayerVisFull(true);
    if (!(await askWindow(true))) {
      giveBack();
      return;
    }
    // Black at the screen's size, drawn, is the first thing to show.
    await untilViewportIsWindow();
    await afterNextFrame();
  } catch (error) {
    giveBack();
    throw error;
  }
  reveal();
  const lift = cover.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: time(FADE_IN_MS),
    easing: 'ease-out',
    fill: 'forwards',
  });
  await lift.finished.catch(() => undefined);
  cover.remove();
};

const leave = async (root: HTMLElement) => {
  const reveal = offScreen(root);
  try {
    // A full screen the listener chose stays, and the picture with it.
    if (await askWindow(false)) {
      // At the size main put the player back to, then laid out as the
      // player and drawn, before it shows — so the player is never laid out
      // at the screen's size. (Main's word that the window left full screen
      // may have let go of the claim already.)
      await untilViewportIsWindow();
      setPlayerVisFull(false);
      await afterNextFrame();
    }
  } finally {
    reveal();
  }
};

const canAnimate = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLElement && typeof element.animate === 'function';

/**
 * The player's picture onto the whole screen (`next`), or back into its deck.
 * `stage` is the picture's own box inside the visualizer deck.
 */
const switchVisFullScreen = async (
  next: boolean,
  stage: HTMLElement | null,
): Promise<void> => {
  if (isChanging) {
    return;
  }
  const root = stage?.closest('.mini-player') ?? null;
  if (
    window.electron?.platform === 'darwin' ||
    !canAnimate(stage) ||
    !canAnimate(root)
  ) {
    setPlayerVisFull(next);
    // What the window answers is what it is: a refusal leaves it as it was,
    // and a full screen the listener chose stays with the picture in it.
    await window.electron?.ipcRenderer?.setWindowFullScreen?.(next)?.then(
      (answer) => setPlayerVisFull(answer),
      () => setPlayerVisFull(!next),
    );
    return;
  }
  isChanging = true;
  try {
    await (next ? enter(root) : leave(root));
  } finally {
    isChanging = false;
  }
};

export default switchVisFullScreen;
