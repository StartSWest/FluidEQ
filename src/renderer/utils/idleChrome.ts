/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Whether the pointer has been still long enough for the chrome to get out of
 * the way.
 *
 * Full screen only, and only because of what full screen is: a picture with a
 * spectrum over it, watched rather than worked on. Every video player on earth
 * fades its controls out when nothing is happening, and the reason is the same
 * here — a row of labels and a creature in the corner are the only things left
 * between the drawing and the edge of the screen.
 *
 * One store rather than a timer per component. The controls live in the graph
 * and the creature lives beside it, and the two disagreeing by a few hundred
 * milliseconds would be one fading while the other did not, which is worse than
 * either behaviour on its own.
 *
 * The same shape as the other small stores here: a module-level value, a set of
 * listeners, and a `useSyncExternalStore` hook so anything reading it
 * re-renders when it moves.
 */

import { useSyncExternalStore } from 'react';

/**
 * How long the pointer has to be still.
 *
 * Five seconds. Two was long enough to reach a control after revealing it,
 * and short enough to be startling: the chrome left while you were still
 * looking at what you had just changed.
 */
export const CHROME_IDLE_MS = 5000;

/**
 * What counts as being here.
 *
 * Pointer movement is the obvious one. Keys matter as well: every one of these
 * controls has a shortcut, so somebody driving the graph entirely from the
 * keyboard is not idle however still the mouse is — and the chrome fading out
 * mid-keystroke would take the labels away exactly when the shortcut changed
 * what they say.
 */
// Presses only count inside the controls. A press on the drawing must reach
// its explicit show/hide toggle without first changing the state it toggles.
const ACTIVITY_EVENTS = [
  'pointermove',
  'keydown',
  'wheel',
  'pointerdown',
  'focusin',
  'focusout',
];

// Dropdown lists are portalled out of the toolbar. Both surfaces must hold
// its controls open while a look or interval is being chosen.
const TOP_CHROME_SELECTOR =
  '.live-output-controls, .graph-look-menu, .graph-auto-cycle-menu';
const isTopChrome = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(TOP_CHROME_SELECTOR) !== null;
let topPointerTarget: Element | null = null;
const isUsingTopChrome = () =>
  !!topPointerTarget?.isConnected || isTopChrome(document.activeElement);

let isIdle = false;
let isWatching = false;
let idleFrame: number | undefined;

/**
 * Something on screen needs the chrome to stay put.
 *
 * The look designer is the case this exists for: it is a panel opened from the
 * toolbar, sitting beside it, and every control in it is judged against the
 * drawing behind. Letting the strip fade while that is open takes away the
 * controls the panel was opened from, and does it at the exact moment somebody
 * has stopped moving the mouse to look at what they just changed.
 *
 * A hold rather than a dismissal in reverse: those two are decisions about what
 * the user wants, and this is a statement that the question does not apply
 * right now.
 */
let isHeld = false;

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setIdle = (next: boolean) => {
  if (next === isIdle) {
    return;
  }
  isIdle = next;
  emit();
};

const clearTimer = () => {
  if (idleFrame !== undefined) {
    window.cancelAnimationFrame(idleFrame);
    idleFrame = undefined;
  }
};

const startIdleClock = () => {
  clearTimer();
  let lastActiveAt = performance.now();
  const tick = (now: number) => {
    // A menu can unmount without a pointermove or blur. Check the real target
    // on animation frames so that closing it releases the hold automatically.
    if (isHeld || isUsingTopChrome() || isUsingSideChrome()) {
      lastActiveAt = now;
    }
    if (now - lastActiveAt >= CHROME_IDLE_MS) {
      idleFrame = undefined;
      setNearBottom(false);
      // The side tabs otherwise have no way back down: they follow the
      // pointer, and a pointer that has left for a second monitor sends no
      // more moves. Five still seconds is what takes the rest of the chrome
      // away, and a handle left glowing at the edge of an unattended picture
      // is the one thing it must not leave behind. Any movement in the band
      // brings it straight back.
      setNearSide(false);
      setIdle(true);
      return;
    }
    idleFrame = window.requestAnimationFrame(tick);
  };
  idleFrame = window.requestAnimationFrame(tick);
};

/**
 * The strips of screen the chrome lives in.
 *
 * Movement brings it back only here, and only the clock takes it away again:
 * five still seconds. Anywhere else on the screen it is somebody
 * watching, singing, or resting a hand on a mouse -- and a bar that came back
 * for any of those was a bar that never stayed away. Reaching for it, on the
 * other hand, means going to where it is: the foot of the window for the
 * transport, the head of it for the graph's own toolbar.
 *
 * The top toolbar keeps a generous approach band because it is itself at the
 * top edge. The transport is different: panels that end above it can contain
 * real controls near the foot of the window, and a 120px detector made merely
 * reaching those controls summon the bar. Ten pixels is still crossed by an
 * approach to the edge without stealing the last part of those panels.
 */
const TOP_WAKE_EDGE_PX = 120;
export const BOTTOM_WAKE_EDGE_PX = 10;

/**
 * The same band in full screen, where the reason for ten pixels does not
 * apply: nothing ends above the transport there — the plot is the window — so
 * there are no controls near the foot to steal. Ten pixels of a 1440px screen
 * is a target you have to aim at, and the bar reads as missing rather than
 * hidden.
 */
const FULL_SCREEN_BOTTOM_WAKE_EDGE_PX = 90;

const bottomWakeEdge = (): number =>
  document.querySelector('.app-workspace.is-app-full')
    ? FULL_SCREEN_BOTTOM_WAKE_EDGE_PX
    : BOTTOM_WAKE_EDGE_PX;

/**
 * Panels shortened by the floating transport become part of its interaction
 * region after it opens.
 *
 * Without that continuity, moving from the bottom edge into the newly lifted
 * panel leaves the transport's physical strip, hides the bar, and moves the
 * control under the pointer again. These are the three surfaces whose lower
 * controls participate in that layout.
 */
const BOTTOM_CHROME_HOLD_SELECTOR =
  '.now-playing-bar, .look-designer, .karaoke-playlist, .karaoke-pitch';

const isInBottomChromeSurface = (event: PointerEvent): boolean =>
  event.target instanceof Element &&
  event.target.closest(BOTTOM_CHROME_HOLD_SELECTOR) !== null;

const isInWakeZone = (event: PointerEvent): boolean =>
  event.clientY >= window.innerHeight - bottomWakeEdge() ||
  event.clientY <= TOP_WAKE_EDGE_PX;

/**
 * Whether the pointer is at one of the window's chrome edges.
 *
 * EITHER edge, and the two bars answer it together: going to the top brings
 * the header AND the transport, going to the bottom brings both as well. They
 * are the app's two strips of chrome and hiding one while showing the other
 * made full screen feel like it had lost a piece rather than tidied itself.
 *
 * Entering an edge reveals them. Leaving starts the same five-second clock as
 * the rest of the chrome; it does not make a bar snap shut under a pointer
 * travelling to a neighbouring control.
 */
let isNearBottom = false;
const bottomListeners = new Set<() => void>();

const setNearBottom = (next: boolean) => {
  if (next === isNearBottom) {
    return;
  }
  isNearBottom = next;
  bottomListeners.forEach((listener) => listener());
};

const subscribeNearBottom = (listener: () => void) => {
  bottomListeners.add(listener);
  return () => {
    bottomListeners.delete(listener);
  };
};

/** True while the pointer is at either strip of chrome. */
export const useIsPointerNearChrome = () =>
  useSyncExternalStore(
    subscribeNearBottom,
    () => isNearBottom,
    () => false,
  );

/**
 * The side edges, where the drawer tabs live.
 *
 * A separate flag from the two horizontal strips, and it follows the pointer
 * rather than the clock. The header and the transport are read while you work
 * — a level, a title, a position — so once summoned they stay for five still
 * seconds. A drawer tab says one thing, "there is a panel this way", and it is
 * answered by pressing it: leaving the edge without pressing means the answer
 * was no, and a handle left glowing over the picture after that is chrome the
 * mode exists to remove.
 *
 * Sixty-four pixels, of which the tab itself occupies thirty. That leaves half
 * the band as approach — enough to be crossed on the way to the edge, narrow
 * enough that dragging the lowest band of the curve, which lives at the left of
 * the plot, does not keep summoning it.
 */
export const SIDE_WAKE_EDGE_PX = 64;

/**
 * Surfaces that hold the tabs out regardless of where the pointer is.
 *
 * An open drawer moves its tab inward to ride on the panel's edge (see
 * `.side-bar-toggle.is-open`), which is nowhere near the band that revealed
 * it. Without this, the tab you just pressed — the one that also closes the
 * panel — faded out from under the pointer still resting on it.
 */
const SIDE_CHROME_SELECTOR =
  '.side-bar-toggle, .right-content-toggle, .is-app-full > .side-bar, .is-app-full > .right-content';

const isSideChrome = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(SIDE_CHROME_SELECTOR) !== null;

const isInSideWakeZone = (event: PointerEvent): boolean =>
  event.clientX <= SIDE_WAKE_EDGE_PX ||
  event.clientX >= window.innerWidth - SIDE_WAKE_EDGE_PX ||
  isSideChrome(event.target);

/**
 * The tab or panel the pointer is actually resting on, if any.
 *
 * The clock below clears the tabs after the same five still seconds as the
 * rest of the chrome, and this is the exception to that: a handle underneath
 * a stationary pointer is one being aimed at, and taking it away leaves the
 * next press landing on the picture instead. Held the same way the toolbar
 * holds itself open while a menu of its own is being read.
 */
let sidePointerTarget: Element | null = null;
const isUsingSideChrome = () => !!sidePointerTarget?.isConnected;

let isNearSide = false;
const sideListeners = new Set<() => void>();

const setNearSide = (next: boolean) => {
  if (next === isNearSide) {
    return;
  }
  isNearSide = next;
  sideListeners.forEach((listener) => listener());
};

const subscribeNearSide = (listener: () => void) => {
  sideListeners.add(listener);
  return () => {
    sideListeners.delete(listener);
  };
};

/** True while the pointer is at a side edge, or on the chrome that edge opens. */
export const useIsPointerNearSideChrome = () =>
  useSyncExternalStore(
    subscribeNearSide,
    () => isNearSide,
    () => false,
  );

const handleActivity = (event?: Event) => {
  // Before every early return below: the side tabs answer the pointer's
  // position and nothing else, so they must be updated on a move that the
  // horizontal chrome ignores — including a move made while the chrome is
  // already idle, which is the state they are meant to appear out of.
  if (event?.type === 'pointermove') {
    sidePointerTarget = isSideChrome(event.target)
      ? (event.target as Element)
      : null;
    setNearSide(isInSideWakeZone(event as PointerEvent));
  }
  if (event?.type === 'pointerdown' && !isTopChrome(event.target)) {
    return;
  }
  if (event?.type === 'pointermove' || event?.type === 'pointerdown') {
    topPointerTarget = isTopChrome(event.target)
      ? (event.target as Element)
      : null;
  }
  if (isUsingTopChrome()) {
    setNearBottom(true);
    setIdle(false);
    startIdleClock();
    return;
  }
  let isInBottomSurface = false;
  let bottomSurfaceHoldsOpen = false;
  if (event?.type === 'pointermove') {
    const move = event as PointerEvent;
    isInBottomSurface = isInBottomChromeSurface(move);
    // A protected editor surface may HOLD a bar that the bottom edge already
    // revealed, but it must never reveal one itself. Treating the whole panel
    // as `nearBottom` made a pointer in the middle of the screen summon the
    // transport — exactly the opposite of the ten-pixel wake target.
    bottomSurfaceHoldsOpen = isInBottomSurface && isNearBottom && !isIdle;
    if (isInWakeZone(move)) {
      setNearBottom(true);
    }
  }
  // Keys and the wheel are deliberate by nature and wake it at once. The
  // pointer has to be where the chrome is — see `isInWakeZone`.
  if (
    isIdle &&
    event?.type === 'pointermove' &&
    !isInWakeZone(event as PointerEvent)
  ) {
    // A side edge reached while the chrome is already away is the ordinary
    // way to summon a drawer tab, and it must not bring the two bars back
    // with it. It does need the clock, though: with nothing running, a
    // pointer that reached the edge and then left the display altogether
    // sends no further moves, and the handle stays lit over an unattended
    // picture for good. Resting ON the tab holds it — see `sidePointerTarget`.
    if (isNearSide) {
      startIdleClock();
    }
    return;
  }
  // Once revealed, the bar and every panel it pushes behave as one continuous
  // target. No idle clock runs while the pointer is inside that target. A
  // surface reached while the bar was hidden is ordinary mid-screen movement
  // and has already returned through the wake-zone guard above.
  if (bottomSurfaceHoldsOpen) {
    setIdle(false);
    clearTimer();
    return;
  }
  // MOVING THE POINTER WAKES IT, HOWEVER IT WENT AWAY.
  //
  // A dismissal used to return here, so a toolbar put away by a click on the
  // drawing stayed away until another click asked for it back. But a click on
  // the plot is also how you drag a band, so the controls vanished during
  // ordinary editing and then ignored every attempt to bring them back by
  // reaching for them. A toolbar that cannot be summoned by moving towards it
  // reads as broken, whatever the reason — so there is no dismissed state
  // left to consult here, only the clock.
  //
  // Held open: present, and no clock running to take it away again.
  if (isHeld) {
    setIdle(false);
    clearTimer();
    return;
  }
  setIdle(false);
  startIdleClock();
};

/**
 * Keep the chrome on screen regardless, while something needs it there.
 *
 * Releasing restarts the clock as though the pointer had just moved, so the
 * toolbar does not vanish the instant a panel is closed — the thing that was
 * holding it open going away is not the same as somebody walking off.
 */
export const setChromeHeld = (next: boolean) => {
  if (next === isHeld) {
    return;
  }
  isHeld = next;
  if (next) {
    // A hold outranks the clock: whatever faded out is needed on screen now.
    clearTimer();
    setIdle(false);
    return;
  }
  handleActivity();
};

/**
 * Put the chrome away now, or bring it back — whichever it is not.
 *
 * Bound to a click on the drawing, and a toggle rather than a hide because a
 * control that only works in one direction is one somebody presses twice and
 * then stops trusting. Waiting out the timer is the right answer for a person
 * who has simply stopped moving, and a strange thing to ask of one who has just
 * said what they want.
 *
 * Showing restarts the clock, so a click to look at something is followed by
 * the same fade as any other reveal.
 */
export const toggleChromeNow = () => {
  if (!isWatching || isHeld) {
    return;
  }
  if (isIdle) {
    handleActivity();
    return;
  }
  clearTimer();
  setIdle(true);
};

/**
 * Bring hidden chrome back without giving the caller toggle semantics.
 *
 * The graph uses a click on its drawing as an explicit show/hide toggle. The
 * Karaoke stage has clickable lyrics and pitch controls, so a click there must
 * only reveal the floating actions and then continue to its original target.
 */
export const revealChromeNow = () => {
  if (!isWatching) {
    return;
  }
  handleActivity();
};

/**
 * Start or stop watching, from whichever component knows the mode.
 *
 * Stopping puts the chrome back rather than leaving it wherever the timer had
 * got to. Coming out of full screen with the controls still faded — and no
 * pointer movement yet to bring them back — is a workspace that looks broken
 * for as long as somebody sits still in it.
 */
export const watchChromeIdle = (next: boolean) => {
  if (next === isWatching) {
    return;
  }
  isWatching = next;

  if (next) {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );
    // Started as present, and on the clock. Entering the mode is itself a
    // gesture, and the chrome vanishing the instant it opens would look like it
    // had failed to draw.
    handleActivity();
    return;
  }

  ACTIVITY_EVENTS.forEach((event) =>
    window.removeEventListener(event, handleActivity),
  );
  clearTimer();
  setNearBottom(false);
  setNearSide(false);
  // A dismissal belongs to the mode it was made in. Carrying it out would mean
  // the next time this mode opened, the toolbar was already hidden and no
  // amount of moving the mouse would explain why. A hold is dropped for the
  // same reason: whatever was asking for it is gone with the mode.
  isHeld = false;
  topPointerTarget = null;
  sidePointerTarget = null;
  setIdle(false);
};

/** Whether the chrome should be out of the way. Always false when not watching. */
export const useIsChromeIdle = () =>
  useSyncExternalStore(
    subscribe,
    () => isIdle,
    () => false,
  );
