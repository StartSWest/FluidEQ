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

import { RefObject, useEffect, useRef } from 'react';

/** The hook instance currently responsible for the classes on `#root`. */
let stripOwner: symbol | undefined;

/**
 * Reserve the strip of window the transport bar sits in.
 *
 * The bar is fixed and portalled to `document.body`, so nothing in the
 * layout knows it is there; without this it floats over the last row of
 * whatever tab is open. `#root.has-now-playing` in `App.scss` pads that room
 * out, and `--now-playing-bar-height` is what it pads by.
 *
 * Shared because both bars are the same bar. The library's draws more — cover
 * art, the format readout, shuffle and repeat — and the other tabs' draws
 * less, but they occupy the same place and have to reserve it the same way.
 * Written twice, the second copy is the one that eventually forgets.
 */
// eslint-disable-next-line import/prefer-default-export -- a hook, not a
// component: the other files here export their store functions the same way.
export const useTransportStrip = (
  ref: RefObject<HTMLElement | null>,
  isShowing: boolean,
  /**
   * Over the content rather than beside it.
   *
   * The class is published either way, because "there is a bar" and "the
   * layout has to make room for it" are two different questions and full
   * screen answers them differently: the picture reaches the bottom edge, and
   * the panels over it still have to clear the bar while it is up.
   */
  isFloating = false,
): void => {
  // Whose turn it is to own the two classes on `#root`.
  //
  // Both bars use this hook and only one of them is ever on screen, but the
  // handover is not clean: React runs the arriving bar's effect before the
  // leaving bar's cleanup, so the one going away wiped the classes the one
  // arriving had just set — and the layout stopped reserving the strip while
  // a bar was still drawn over it. The token makes a cleanup a no-op unless
  // it is still the current owner.
  const ownerRef = useRef<symbol>(Symbol('transport-strip'));

  useEffect(() => {
    const root = document.getElementById('root');
    const owner = ownerRef.current;
    // A BAR WITH NOTHING TO SHOW DOES NOT OWN THE STRIP.
    //
    // The token below was written to make a *cleanup* a no-op for a bar that
    // is no longer the owner, and the effect body ignored it — so an instance
    // with `isShowing` false took ownership anyway and wrote both classes
    // off. Two of these are mounted at once: the library's bar stays in the
    // tree with its tab hidden, and with no queue it asks for nothing. Its
    // effect ran last, and `#root` came back with neither class on it while a
    // bar was on screen — measured in the running window as
    // `class="minimized"` with the idle bar drawn over the sidebar's last
    // 64px. Writing the classes is the owner's job; a bar that is not showing
    // only releases them, and only if they were its own.
    if (!isShowing) {
      if (stripOwner === owner) {
        stripOwner = undefined;
        root?.classList.remove('has-now-playing');
        root?.classList.remove('is-floating-bar');
      }
      return undefined;
    }
    stripOwner = owner;
    root?.classList.add('has-now-playing');
    root?.classList.toggle('is-floating-bar', isFloating);
    return () => {
      if (stripOwner !== owner) {
        return;
      }
      stripOwner = undefined;
      root?.classList.remove('has-now-playing');
      root?.classList.remove('is-floating-bar');
    };
  }, [isFloating, isShowing]);

  // `ResizeObserver` is absent in the jsdom these bars' tests run under — see
  // `WaveformVisualizer.tsx` for the same guard — so this is a no-op there
  // rather than something to mock.
  useEffect(() => {
    const element = ref.current;
    const root = document.getElementById('root');
    if (!element || !root || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const applyHeight = () => {
      // The card's own height plus the inset it sits on, and NOT the distance
      // from the foot of the window to its top edge.
      //
      // Those two are the same number only while the bar is where the
      // stylesheet puts it. Hidden, it is translated a full height downwards,
      // and measuring the gap then published something close to zero — which
      // is the figure the layout went on reserving when full screen ended,
      // leaving the bar sitting over the content it had just docked above.
      // `offsetHeight` ignores transforms, which is exactly why it is right
      // here.
      const inset =
        Number.parseFloat(window.getComputedStyle(element).bottom) || 0;
      root.style.setProperty(
        '--now-playing-bar-height',
        `${Math.round(element.offsetHeight + inset)}px`,
      );
    };
    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, isFloating, isShowing]);
};
