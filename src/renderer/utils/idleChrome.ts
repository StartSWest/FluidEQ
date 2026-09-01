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
// Pressing is deliberately absent. A click on the drawing *toggles* the chrome
// — see `toggleChromeNow` — and it cannot toggle anything if the press that
// carries it has already brought the chrome back a moment earlier. Moving the
// pointer still reveals, which is the gesture people actually reach for.
const ACTIVITY_EVENTS = ['pointermove', 'keydown', 'wheel'];

/**
 * The one key that does not wake anything, and the reason for the exception.
 *
 * Space walks the visualiser styles, and walking them is the most watching
 * thing there is to do in this mode — several presses in a row, looking at the
 * result of each. Treating that as activity meant the toolbar reappeared on
 * every press, which is the opposite of what somebody flipping through looks is
 * asking for. Every other shortcut changes what the labels say, so every other
 * shortcut still brings them back to be read.
 */
const isQuietKey = (event: KeyboardEvent) =>
  event.code === 'Space' || event.key === ' ';

let isIdle = false;
let isWatching = false;
let timer: number | undefined;

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
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
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
 * Panels shortened by the floating transport become part of its interaction
 * region after it opens.
 *
 * Without that continuity, moving from the bottom edge into the newly lifted
 * panel leaves the transport's physical strip, hides the bar, and moves the
 * control under the pointer again. These are the three surfaces whose lower
 * controls participate in that layout.
 */
const BOTTOM_CHROME_HOLD_SELECTOR =
  '.look-designer, .karaoke-playlist, .karaoke-pitch';

const isInBottomChromeSurface = (event: PointerEvent): boolean =>
  event.target instanceof Element &&
  event.target.closest(BOTTOM_CHROME_HOLD_SELECTOR) !== null;

const isInWakeZone = (event: PointerEvent): boolean =>
  event.clientY >= window.innerHeight - BOTTOM_WAKE_EDGE_PX ||
  event.clientY <= TOP_WAKE_EDGE_PX;

/**
 * Whether the pointer is down where the transport bar lives.
 *
 * The bar has two ways to go: the pointer leaving its strip, and the clock
 * running out. Leaving is the quick one and is what somebody who came for one
 * button expects; the clock catches the case where the pointer stops inside
 * the strip and stays there.
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

/** True while the pointer is within the bar's own strip of screen. */
export const useIsPointerNearBottom = () =>
  useSyncExternalStore(
    subscribeNearBottom,
    () => isNearBottom,
    () => false,
  );

const handleActivity = (event?: Event) => {
  let isInBottomSurface = false;
  if (event?.type === 'pointermove') {
    const move = event as PointerEvent;
    isInBottomSurface = isInBottomChromeSurface(move);
    setNearBottom(
      move.clientY >= window.innerHeight - BOTTOM_WAKE_EDGE_PX ||
        isInBottomSurface,
    );
  }
  if (event?.type === 'keydown' && isQuietKey(event as KeyboardEvent)) {
    return;
  }
  // Keys and the wheel are deliberate by nature and wake it at once. The
  // pointer has to be where the chrome is — see `isInWakeZone`.
  if (
    isIdle &&
    event?.type === 'pointermove' &&
    !isInWakeZone(event as PointerEvent)
  ) {
    return;
  }
  // Once revealed, the bar and every panel it pushes behave as one continuous
  // target. No idle clock runs while the pointer is inside that target; moving
  // outside flips `isNearBottom` off and lets the bar leave immediately.
  if (isInBottomSurface) {
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
  clearTimer();
  timer = window.setTimeout(() => setIdle(true), CHROME_IDLE_MS);
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
  // A dismissal belongs to the mode it was made in. Carrying it out would mean
  // the next time this mode opened, the toolbar was already hidden and no
  // amount of moving the mouse would explain why. A hold is dropped for the
  // same reason: whatever was asking for it is gone with the mode.
  isHeld = false;
  setIdle(false);
};

/** Whether the chrome should be out of the way. Always false when not watching. */
export const useIsChromeIdle = () =>
  useSyncExternalStore(
    subscribe,
    () => isIdle,
    () => false,
  );
