/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
 * Long enough not to fire while somebody is reaching for a control, short
 * enough that it does happen once they have stopped. Video players sit between
 * two and four seconds; this is in the middle of that.
 */
export const CHROME_IDLE_MS = 2600;

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

const handleActivity = (event?: Event) => {
  if (event?.type === 'keydown' && isQuietKey(event as KeyboardEvent)) {
    return;
  }
  setIdle(false);
  clearTimer();
  timer = window.setTimeout(() => setIdle(true), CHROME_IDLE_MS);
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
  if (!isWatching) {
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
  setIdle(false);
};

/** Whether the chrome should be out of the way. Always false when not watching. */
export const useIsChromeIdle = () =>
  useSyncExternalStore(
    subscribe,
    () => isIdle,
    () => false,
  );
