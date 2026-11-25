/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useSyncExternalStore, type RefObject } from 'react';

const subscribe = (changed: () => void) => {
  document.addEventListener('fullscreenchange', changed);
  return () => document.removeEventListener('fullscreenchange', changed);
};

/**
 * Whether `target` is what the screen is full of, as the browser says so.
 *
 * What a full-screen layout is keyed on, rather than the size the member
 * pressed for. The Studio's grid laid itself out for full screen from its
 * size, which flips at the press, while the screen fills some frames later
 * and empties some frames after the press to leave: going in, the panes and
 * a stage a whole screen wide were drawn inside the window, overflowing it;
 * coming back, the window's layout — the chat beside the stage, the stage
 * twice its height and shrinking back over several frames — was drawn over
 * the whole screen (Ivan, 2026-11-25: "the side pane opens and makes things
 * glitch").
 *
 * Read straight from the browser at every render and on every
 * `fullscreenchange`, which React counts as a discrete event: the change is
 * committed in the microtask after the listener, inside the very frame the
 * browser changes the screen in, before its layout and paint, so the layout
 * and the screen change together, once. Nothing may wait for a later frame
 * here — a frame waited for is a frame painted the old way.
 */
export default function useFullscreenShown(
  target: RefObject<HTMLElement | null>,
): boolean {
  const isShown = useCallback(
    () =>
      target.current !== null && document.fullscreenElement === target.current,
    [target],
  );
  return useSyncExternalStore(subscribe, isShown, () => false);
}
