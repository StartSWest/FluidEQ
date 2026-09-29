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

import { type RefObject, useEffect } from 'react';
import {
  enterPlayerOnlyScript,
  EXIT_PAGE_FULLSCREEN,
  exitPlayerOnlyScript,
  PLAYER_ONLY_CSS,
} from './videoPlayerScripts';
import { type IWebview } from './videoWebview';
import { type TGraphView } from '../utils/graphViewSettings';

/**
 * Which run of the page-stripping is the current one.
 *
 * Module scope rather than component state: nothing renders from it, it must
 * survive a remount, and it only ever counts up. See `exitPlayerOnlyScript`.
 */
let soloGeneration = 0;

interface IVideoPlayerOnlyInput {
  webviewRef: RefObject<IWebview | null>;
  isHidden: boolean;
  isGuestReady: boolean;
  graphView: TGraphView;
}

/**
 * The guest page under an expanded graph: its own full screen left, and the
 * page stripped down to its player pinned to the viewport, in the ordinary
 * layers where the graph can be drawn on top. Put back when the graph
 * returns to normal or the tab is left.
 */
const useVideoPlayerOnly = ({
  webviewRef,
  isHidden,
  isGuestReady,
  graphView,
}: IVideoPlayerOnlyInput) => {
  /**
   * Strip the page back to its player while the graph is over it.
   *
   * Re-applied when the guest reloads: a navigation throws inserted CSS away
   * with the document, so without `isGuestReady` in the dependencies the second
   * video would come back wearing the whole page.
   */
  /**
   * Make sure the page is *not* in its own fullscreen while a mode is on.
   *
   * Tried the other way and it cannot work, for a reason that is structural
   * rather than a value to tune: when the guest enters HTML fullscreen, Electron
   * puts the `<webview>` element itself into the host document's top layer. The
   * top layer is above every stacking context by definition — that is what it
   * is for — so no `z-index` on this side can reach over it and the graph is
   * simply not on screen. A video with a spectrum over it is the entire point
   * of these modes, so the site's fullscreen is the thing that has to go.
   *
   * The stripping below does the same job without it: the page is reduced to
   * its player, pinned to the viewport, in the ordinary layers where the graph
   * can be drawn on top.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || graphView === 'normal') {
      return;
    }
    try {
      // Asked without a gesture, unlike the call this replaces. Leaving a
      // fullscreen is not gesture-gated — only entering one is — so the flag
      // bought nothing here, and it cost something: it grants the guest a user
      // activation, which is the page's licence to start playing on its own.
      // This effect runs at `dom-ready` whenever the graph is expanded, so with
      // the flag on, opening the tab in that state was the autoplay again by
      // another road.
      view.executeJavaScript(EXIT_PAGE_FULLSCREEN).catch(() => undefined);
    } catch {
      // The guest went away, and took its fullscreen with it.
    }
  }, [graphView, isGuestReady, isHidden, webviewRef]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || graphView === 'normal') {
      return undefined;
    }
    let key: string | undefined;
    let isCancelled = false;
    // Claimed before either call goes out, so the teardown below carries the
    // same number as the setup it belongs to, whichever order they land in.
    soloGeneration += 1;
    const generation = soloGeneration;
    // Named rather than inline in the chain: the removal it may issue is a
    // promise of its own, and a chain inside a handler is what reads as a
    // race when it is not one.
    const keepOrRemove = (inserted: string) => {
      if (isCancelled) {
        // The mode changed while this was in flight. Take it straight back
        // out rather than leaving a sheet nothing holds the key to.
        //
        // Wrapped for the same reason `executeJavaScript` is throughout this
        // file: it asks the tag for a web contents id, and a tag that is no
        // longer attached answers that by THROWING rather than rejecting, so
        // a `.catch` alone does not catch it. See the cleanup below, where
        // that difference had teeth.
        try {
          view.removeInsertedCSS(inserted).catch(() => undefined);
        } catch {
          // Detached; the sheet went with the document.
        }
      } else {
        key = inserted;
      }
      return inserted;
    };
    try {
      view
        .insertCSS(PLAYER_ONLY_CSS)
        .then(keepOrRemove)
        .catch(() => undefined);
      // The stylesheet does nothing until the chain is marked; the two go in
      // together and come out together.
      view
        .executeJavaScript(enterPlayerOnlyScript(generation))
        .catch(() => undefined);
    } catch {
      // No web contents to inject into, and so nothing to undo either.
    }
    return () => {
      isCancelled = true;
      if (key !== undefined) {
        /**
         * A RENDER ERROR ANYWHERE IN THE APP USED TO ARRIVE HERE AS A SECOND,
         * FATAL ONE.
         *
         * React unmounts the whole tree when a render throws, and this cleanup
         * runs with the `<webview>` already detached. `removeInsertedCSS` asks
         * the tag for a web contents id, which a detached tag answers by
         * THROWING — not by rejecting — so the `.catch` beside it never saw
         * it. The unmount then threw while React was recovering from the first
         * error, and what should have been one recoverable crash became
         * "automatic window recovery budget exhausted" with this stack on the
         * screen instead of the real one.
         */
        try {
          view.removeInsertedCSS(key).catch(() => undefined);
        } catch {
          // Detached; the sheet went with the document.
        }
      }
      try {
        view
          .executeJavaScript(exitPlayerOnlyScript(generation))
          .catch(() => undefined);
      } catch {
        // The guest is gone, which disconnects the observer rather more
        // thoroughly than asking it to.
      }
    };
    // Deliberately not keyed on `pageToken`, however tempting it looks.
    //
    // A navigation does throw the inserted CSS away, and this effect does only
    // run once — so re-running it per document reads like the obvious fix. It
    // is not: the cleanup disconnects the observer and unmarks the tree while
    // the new run is inserting a sheet and marking it again, and the two orders
    // those can land in are "stripped" and "black". Tried, and it broke the
    // player intermittently, which is worse than the thing it was fixing.
    //
    // Whatever replaces this has to sequence the teardown against the setup
    // rather than let React interleave them.
  }, [graphView, isGuestReady, isHidden, webviewRef]);
};

export default useVideoPlayerOnly;
