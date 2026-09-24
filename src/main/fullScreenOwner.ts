/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHO PUT THE WINDOW IN FULL SCREEN: THE PAGE, OR THE LISTENER THROUGH THE
 * SYSTEM.
 *
 * On Windows only the page ever did — the graph's largest view, the player's
 * visualizer — so a full-screen window nothing in the page claimed could only
 * be one a reload had left behind, and the page took it straight back out
 * (`reconcileWindowState` in `App.tsx`). A Mac has a green button on every
 * window and Enter Full Screen in its View menu, and a full screen asked for
 * there is the listener's: the whole app in its own space, windowed layout
 * and all. Taken back out, the green button was a button that visibly did
 * nothing. The same holds for a development build's F11.
 *
 * So the page says when it asks (`asked`), and whichever full screen begins
 * without a request in front of it is the system's until it ends. A system
 * full screen also outlasts the page's own asks: the graph's largest view,
 * opened and closed inside it, hands the window back as the listener left it,
 * not out of the full screen they chose.
 */
export const createFullScreenOwner = () => {
  let hasAsked = false;
  let owner: 'page' | 'system' | undefined;
  return {
    /** The page is about to ask the window for full screen. */
    asked: () => {
      hasAsked = true;
    },
    /** The window's `enter-full-screen`. */
    entered: () => {
      owner = hasAsked ? 'page' : 'system';
      hasAsked = false;
    },
    /** The window's `leave-full-screen`. */
    left: () => {
      owner = undefined;
      hasAsked = false;
    },
    isSystem: () => owner === 'system',
  };
};

export type TFullScreenOwner = ReturnType<typeof createFullScreenOwner>;
