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

interface IStripClaim {
  isFloating: boolean;
  /** The room the bar takes, once it has been measured while drawn. */
  height: number | undefined;
}

/**
 * Every bar that is up now, oldest first.
 *
 * THE CLASSES ON `#root` ARE WORKED OUT FROM ALL OF THEM, EVERY TIME.
 *
 * They used to belong to one owner: the last bar to claim them, and a bar
 * leaving released them if it was still that owner. Three bars use this hook
 * (the Library's, the other tabs', and the idle one that says what played
 * last), two could be up at once, and then it broke whenever the second one
 * up was the first one down. On a tab with no player of its own, a Library
 * song restored from the last session and not played since is picked by no
 * rule (`pickTransportOwner`), so the idle bar came up beside the Library's,
 * became the owner, and on the way back to the Library left and took the
 * reservation with it while the Library's bar stayed drawn with no reason to
 * claim again. The Library slid under the bar, its "Add folder" row cut in
 * half (Ivan, 2026-11-16: "fix this issue once and for all the bottom player
 * bar sometimes overlaps"). A set has no order of effects to get wrong: the
 * strip is reserved for as long as any bar is up.
 */
const claims = new Map<symbol, IStripClaim>();

/**
 * Write what the claims say onto `#root`. The newest claim is the bar on
 * top, so it is the one whose floating and height count; a bar that has not
 * been measured yet leaves the height the last one published, which is the
 * room the same bar took before it was hidden.
 */
const publishClaims = () => {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }
  const newest = Array.from(claims.values()).pop();
  root.classList.toggle('has-now-playing', newest !== undefined);
  root.classList.toggle('is-floating-bar', newest?.isFloating === true);
  if (newest?.height !== undefined) {
    root.style.setProperty('--now-playing-bar-height', `${newest.height}px`);
  }
};

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
const useTransportStrip = (
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
  const claimRef = useRef<symbol>(Symbol('transport-strip'));
  // What this bar measured last, kept across its claims: a bar that comes
  // back reserves the room it took before it is measured again.
  const heightRef = useRef<number | undefined>(undefined);

  // A BAR WITH NOTHING TO SHOW CLAIMS NOTHING. Two of these are mounted at
  // once whatever happens: the library's bar stays in the tree with its tab
  // hidden, and with no queue it asks for nothing.
  useEffect(() => {
    if (!isShowing) {
      return undefined;
    }
    const claim = claimRef.current;
    claims.set(claim, { isFloating, height: heightRef.current });
    publishClaims();
    return () => {
      claims.delete(claim);
      publishClaims();
    };
  }, [isFloating, isShowing]);

  // `ResizeObserver` is absent in the jsdom these bars' tests run under — see
  // `WaveformVisualizer.tsx` for the same guard — so this is a no-op there
  // rather than something to mock.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const applyHeight = () => {
      // NOTHING IS MEASURED OFF A BAR THAT IS NOT DRAWN. Behind the amp the
      // bar is `display: none` (`_miniPlayerShell.scss`) and measures 0, and
      // that 0 was kept: the full window came back from the amp with no room
      // for the bar and laid its first frame out to the window's foot, and in
      // Ivan's window the glass side panes were still drawn there, under the
      // bar, after the room came back (2026-10-01: "happens when coming from
      // the amp view to the full"). The room the bar last took is the room it
      // takes when it is drawn again; if it comes back another height, the
      // observer reports that like any other change.
      if (element.getClientRects().length === 0) {
        return;
      }
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
      heightRef.current = Math.round(element.offsetHeight + inset);
      const claim = claims.get(claimRef.current);
      if (claim) {
        claim.height = heightRef.current;
        publishClaims();
      }
    };
    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    // The border box, which is what `offsetHeight` reads. Observed by its
    // content box, a bar that grew only in its padding was never measured
    // again: under the Backdrop's glass it is 10px taller with the same
    // content, and the layout went on reserving the old height, the panes
    // standing on the bar's glass with no gap (Ivan, 2026-09-27: "fix the
    // bottom no gap on player bar").
    observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, [ref, isFloating, isShowing]);
};

export default useTransportStrip;
