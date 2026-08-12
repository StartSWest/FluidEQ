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

import { RefObject, useEffect } from 'react';

/**
 * Selector for the things a person can actually land on with the keyboard.
 *
 * Deliberately narrow. The two modals that use this contain buttons and links
 * and nothing else, and a selector that also matched inputs, iframes and
 * `contenteditable` would be describing a dialog neither of them is.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep keyboard focus inside one element for as long as it is on screen.
 *
 * One user: `DisclaimerGate`, the first-run acknowledgement, which is the only
 * dialog in the app that genuinely cannot be dismissed. `aria-modal` tells
 * assistive technology that the rest of the page is inert; it does not stop
 * Tab, and "cannot be tabbed out of" has to actually be true for a dialog whose
 * whole purpose is that there is no way past it.
 *
 * The mandatory-update notice was the second user and no longer is. It closes
 * now, and the two handlers below are exactly why a closable dialog must not
 * have this: the Escape handler eats the key such a dialog closes on, and the
 * `focusin` handler drags focus back out of the app the user was let into. If a
 * third dialog ever wants this hook, that is the question to ask about it
 * first — and if two locked dialogs are ever on screen together, the one in
 * front is the only one that may hold the lock, since these listeners are on
 * the document and know nothing about what is painted over them.
 *
 * Three things, all on the document in the capture phase so nothing below can
 * see the event first:
 *
 *   - **Escape is eaten.** Not merely ignored: several components in this app
 *     close themselves on a document-level Escape, and one of them being open
 *     underneath must not turn Escape into a way of doing something.
 *   - **Tab wraps.** Off the last control back to the first, and off the first
 *     backwards to the last.
 *   - **Focus that got out is brought back.** Tab is not the only way to leave
 *     — a click on the backdrop, a `focus()` from some other component's
 *     effect, or the window regaining focus can all land somewhere outside.
 *     The `focusin` listener is what makes the guarantee hold rather than the
 *     Tab handler, which only covers the case it can see coming.
 *
 * The element is focused on mount, so the first Tab starts from inside.
 */
export const useFocusLock = (
  ref: RefObject<HTMLElement | null>,
  isActive = true,
) => {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const root = ref.current;
    if (!root) {
      return undefined;
    }

    const focusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));

    // The first control rather than the container, so a screen reader starts
    // on something actionable and the first Tab moves to the second control
    // rather than into the first.
    const initial = focusable()[0] ?? root;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const items = focusable();
      if (items.length === 0) {
        // Nothing to move to. Staying put is the only correct answer; letting
        // Tab through would move focus into the blocked app behind.
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (target && root.contains(target)) {
        return;
      }
      (focusable()[0] ?? root).focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [ref, isActive]);
};
