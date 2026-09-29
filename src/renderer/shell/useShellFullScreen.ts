/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IWindowState } from 'common/windowMode';
import { holdGraphUntil } from '../graph/graphArrival';
import { setPlayerVisFull } from '../player/playerLayout';
import {
  afterNextFrame,
  untilViewportIsWindow,
} from '../player/windowModeStore';
import {
  exitGraphFullScreen,
  getGraphView,
  onWindowFullScreenChange,
  toggleGraphExpanded,
  toggleGraphFullScreen,
  useFullScreenTopBar,
} from '../utils/graphStyle';
import {
  useIsChromeIdle,
  useIsPointerNearChrome,
  useIsPointerNearSideChrome,
  watchChromeIdle,
} from '../utils/idleChrome';
import { reportError } from '../utils/logger';
import useAppFullMark from '../utils/useAppFullMark';
import type { TWorkspaceTab } from '../workspaceTabs';
import { isFullscreenMediaTab } from './workspaceGroups';

export interface IShellFullScreenInput {
  activeWorkspaceTab: TWorkspaceTab;
  /** Whether the open tab draws its response graph. */
  showsGraph: boolean;
  graphView: ReturnType<typeof getGraphView>;
  /** The player's visualizer on the whole screen, which claims it too. */
  isPlayerVisFull: boolean;
  /** Switches the open tab's graph on or off, for the graph shortcuts. */
  setActiveTabGraphVisibility: (next: boolean) => void;
}

/**
 * The window's full screen: who asked for it — the graph's largest view or a
 * player's surface — keeping the app and the window agreeing about it, the
 * maximised state beside it, and the chrome that fades while it lasts.
 */
const useShellFullScreen = ({
  activeWorkspaceTab,
  showsGraph,
  graphView,
  isPlayerVisFull,
  setActiveTabGraphVisibility,
}: IShellFullScreenInput) => {
  // WHICH playback workspace owns the native-window full screen, not merely
  // whether one does. Karaoke originated the control and Library and Online
  // Media share it so there can never be two, but as a bare boolean it read
  // `true` on all three at once: taking the Karaoke stage full screen and then
  // pressing Library handed Library a full-screen window it never asked for,
  // titlebar gone and its floating controls stacked over each other. Full
  // screen belongs to the surface that entered it, and a navigation leaves it
  // — the same rule the graph modes have always had.
  const [mediaFullScreenOwner, setMediaFullScreenOwner] = useState<
    TWorkspaceTab | undefined
  >(undefined);
  const isMediaFullScreen = mediaFullScreenOwner !== undefined;
  const mediaFullScreenRequestedRef = useRef(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  /** The window itself is full screen, so the titlebar is not on screen. */
  const isGraphAppFullScreen =
    graphView === 'fullscreen' && showsGraph && !isMediaFullScreen;
  // Full screen with the top bar kept. Everything below reads this rather than
  // the mode alone, so "full screen" and "full screen with the bar" cannot end
  // up disagreeing about which pieces are on screen.
  const hasFullScreenTopBar = useFullScreenTopBar();
  const isChromeHidden =
    (isGraphAppFullScreen || isMediaFullScreen) && !hasFullScreenTopBar;
  /**
   * Full screen, whether or not the top bar is showing.
   *
   * `isChromeHidden` is a narrower question — it asks whether the chrome is
   * getting out of the way, which the top-bar toggle can veto. The transport
   * bar floats over the stage in every full screen: the picture is meant to
   * reach the bottom edge, and a reserved strip there is a band of background
   * under a stage that should have filled it.
   */
  const isAppFullScreen = isGraphAppFullScreen || isMediaFullScreen;
  useAppFullMark(isAppFullScreen);
  /**
   * Whether anything in here is actually claiming the full-screen window.
   *
   * Read from the window's own state messages, which arrive from outside
   * React and therefore cannot see this render's values — hence a ref,
   * rewritten every render. Its job is to answer one question: the window
   * says it is full screen, but is that because we asked?
   *
   * When the answer is no the two have come apart, and they can: a renderer
   * reload leaves the window exactly as it was while every piece of state in
   * here starts again at nothing. What that looked like was a full-screen
   * window with the windowed layout drawn in it, and a double-click that
   * appeared to do nothing because it was the one putting the app back IN
   * step — which is the "I have to do it twice" this exists to end.
   */
  const windowFullScreenClaimRef = useRef(false);
  // The player's visualizer counts as a claim too: its picture on the whole
  // screen is the window changing, and without this the reconciliation below
  // would take the window straight back out of the mode it was just put in.
  windowFullScreenClaimRef.current = isAppFullScreen || isPlayerVisFull;

  // Watched only in full screen, and stopped on the way out — see the store for
  // why leaving it running would strand a faded workspace.
  const isChromeIdle = useIsChromeIdle();
  // The bar answers to the pointer, not to the clock — see `idleChrome`.
  const isPointerNearChrome = useIsPointerNearChrome();
  // The drawer tabs answer the side edges the same way.
  const isPointerNearSideChrome = useIsPointerNearSideChrome();

  // Published on `#root` for the stylesheets that have to know: a panel over
  // a floating bar clears it while it is up and takes the room back when it
  // fades, and CSS cannot read a React flag.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle(
      'is-chrome-idle',
      isAppFullScreen && (!isPointerNearChrome || isChromeIdle),
    );
    return () => root?.classList.remove('is-chrome-idle');
  }, [isAppFullScreen, isChromeIdle, isPointerNearChrome]);
  // And the same for the two drawer tabs, which are the only chrome that
  // lives on the vertical edges. Kept apart from the flag above so that
  // reaching for a panel does not also summon the header and the transport.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle(
      'is-side-chrome-awake',
      isAppFullScreen && isPointerNearSideChrome,
    );
    return () => root?.classList.remove('is-side-chrome-awake');
  }, [isAppFullScreen, isPointerNearSideChrome]);
  useEffect(() => {
    // Every mode the graph is drawn in, not only the ones that fill the
    // screen.
    //
    // This started as a full-screen behaviour on the theory that a toolbar
    // only gets in the way once the picture is the whole window. It gets in
    // the way in the ordinary view too: the strip lies over the top of the
    // plot, which is where the peaks go, and the controls on it are ones you
    // reach for occasionally and then look past for minutes at a time.
    //
    // Tied to visible auto-hiding chrome: the graph in any view, or Karaoke's
    // centre dock while its stage owns the full screen. With neither rendered
    // there is no listener on the window watching activity for nothing.
    // `isChromeHidden` as well: full screen fades the transport bar too, and a
    // full-screen surface with no graph on it would otherwise have nothing
    // watching for the stillness that fades it.
    watchChromeIdle(showsGraph || isMediaFullScreen || isChromeHidden);
    return () => watchChromeIdle(false);
  }, [isChromeHidden, isMediaFullScreen, showsGraph]);

  /**
   * THE ONE WAY THIS APP ASKS FOR A FULL-SCREEN WINDOW.
   *
   * Take the window full screen when the graph asks for its largest view, or
   * when a player takes the shared media surface. Full screen rather than
   * maximised, and that is the point of the mode: the taskbar goes, so a video
   * or a spectrum has the whole glass. FluidEQ's own header stays on top of
   * it.
   *
   * Both routes to the mode go through here, so the claim the window's own
   * state messages are reconciled against is written in the same breath as
   * the request that creates it. Two callers each doing their own IPC is how
   * the app and the window came to disagree in the first place: whichever of
   * them spoke last, nothing recorded that anybody had. Registered here
   * rather than done in the store, because it is an IPC call and a layout
   * preference should not have to know the shape of the app's API to hold a
   * value. The store says *what* it wants; this says how.
   */
  const requestWindowFullScreen = useCallback((next: boolean) => {
    windowFullScreenClaimRef.current = next;
    return window.electron.ipcRenderer.setWindowFullScreen(next);
  }, []);

  // The graph goes out of sight while the window changes size for it and
  // fades in once the page is drawn at the new size (`graphArrival.ts`):
  // main answers once it has moved the window, and the page's own size says
  // when that has reached it.
  useEffect(() => {
    onWindowFullScreenChange((next) => {
      const moved = requestWindowFullScreen(next);
      holdGraphUntil(moved.then(untilViewportIsWindow).then(afterNextFrame));
      moved.catch((e) => {
        reportError('Could not change the window to full screen', e);
      });
    });
    return () => onWindowFullScreenChange(() => undefined);
  }, [requestWindowFullScreen]);

  /** `undefined` leaves full screen; a tab takes it, and owns it. */
  const applyMediaFullScreen = useCallback(
    async (owner: TWorkspaceTab | undefined) => {
      const next = owner !== undefined;
      mediaFullScreenRequestedRef.current = next;
      setMediaFullScreenOwner(owner);
      try {
        const applied = await requestWindowFullScreen(next);
        mediaFullScreenRequestedRef.current = next && applied;
        setMediaFullScreenOwner(next && applied ? owner : undefined);
      } catch (error) {
        mediaFullScreenRequestedRef.current = false;
        setMediaFullScreenOwner(undefined);
        reportError('Could not change the media surface full screen', error);
      }
    },
    [requestWindowFullScreen],
  );

  /**
   * The shared media surface gives the window up to the graph without
   * leaving full screen: ownership moves in React, and the graph store then
   * applies the view it was asked for, so Chromium does not resize a live
   * video twice.
   */
  const releaseMediaSurface = useCallback(() => {
    mediaFullScreenRequestedRef.current = false;
    setMediaFullScreenOwner(undefined);
  }, []);

  // Ctrl+F and Ctrl+S always mean graph fullscreen and expanded mode in a
  // playback workspace. This listener also covers Library and Karaoke when
  // their normal per-tab graph is hidden, where FrequencyResponseChart has no
  // mounted listener of its own to hear either shortcut. The player's explicit
  // fullscreen controls use the shared media surface instead; separate
  // commands, separate visible results, all App-owned.
  useEffect(() => {
    const isMediaTab = isFullscreenMediaTab(activeWorkspaceTab);
    if (!isMediaTab && !isMediaFullScreen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Reading help must not toggle the playback surface behind its modal.
      if (document.querySelector('dialog.help-guide[open]')) {
        return;
      }
      const shortcut = event.key.toLowerCase();
      const wantsToggle =
        isMediaTab &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.repeat &&
        (shortcut === 'f' || shortcut === 's');
      const wantsExit = event.key === 'Escape' && isMediaFullScreen;
      if (!wantsToggle && !wantsExit) {
        return;
      }
      if (
        wantsExit &&
        (document.querySelector(
          '[role="dialog"]:not(.karaoke-maker), .dropdown--open',
        ) ||
          (event.target as HTMLElement | null)?.closest?.(
            'input, textarea, [contenteditable]',
          ))
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (wantsExit) {
        applyMediaFullScreen(undefined);
        return;
      }

      // Switching from the no-graph media surface to a graph mode must not
      // bounce the BrowserWindow out and back in. Transfer ownership in React,
      // then let the graph store apply the requested view; for Ctrl+F the OS
      // window is already in the requested state.
      if (isMediaFullScreen) {
        releaseMediaSurface();
      }
      setActiveTabGraphVisibility(true);
      if (shortcut === 's') {
        toggleGraphExpanded();
      } else {
        toggleGraphFullScreen();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeWorkspaceTab,
    applyMediaFullScreen,
    isMediaFullScreen,
    releaseMediaSurface,
    setActiveTabGraphVisibility,
  ]);

  /**
   * CHANGING WORKSPACE PAGES LEAVES FULL SCREEN — ANY PAGE, NOT JUST A
   * NON-PLAYBACK ONE.
   *
   * This used to release the window only when the new tab was outside the
   * three playback workspaces, on the reasoning that they share one full
   * screen so there is nothing to hand over. But sharing the *window* is not
   * sharing the *layout*: Karaoke full screen is a lyric stage with the
   * titlebar gone, and arriving on Library still in it gave that tab a
   * hidden titlebar with its own floating controls piled into the space —
   * exactly the "the tab press did nothing" that `selectTopWorkspaceTab`
   * already prevents for the graph modes. So the owner is compared to the
   * open tab, and any mismatch leaves.
   */
  useEffect(() => {
    if (
      mediaFullScreenOwner !== undefined &&
      mediaFullScreenOwner !== activeWorkspaceTab
    ) {
      applyMediaFullScreen(undefined);
    }
  }, [activeWorkspaceTab, applyMediaFullScreen, mediaFullScreenOwner]);

  useEffect(() => {
    let mounted = true;

    /**
     * THE WINDOW IS THE AUTHORITY ON WHETHER IT IS FULL SCREEN.
     *
     * This used to believe it only while a request of ours was in flight,
     * which left the app free to disagree with the window for as long as it
     * liked — and it did. Two states for one fact is the bug Ivan named: the
     * window full screen, this app drawing the windowed layout, and a
     * full-screen press that appeared to do nothing because what it actually
     * did was put the two back in step.
     *
     * Both directions are reconciled here, which is what makes this the one
     * place that decides:
     *
     *  - Not full screen: nothing may still own a full-screen surface. That
     *    covers the window being taken out of it by any route we did not ask
     *    about, F11 and the system menu among them — and on a Mac the green
     *    button, which is on screen over every full-screen window there. A
     *    window that WAS full screen and left it while something in here still
     *    claimed it was taken out from under that claim, and every claim goes:
     *    the graph's largest view and the player's visualizer as well as the
     *    media surface, or they would draw their full-screen layout in a
     *    window.
     *
     *  - Full screen with nothing in here claiming it: the two have come
     *    apart, and the window is the half that is wrong — no tab is drawing
     *    a full-screen layout, so it is showing a windowed one with the
     *    titlebar gone. Put it back. Unless it is the listener's own full
     *    screen (`isSystemFullScreen`): a Mac's green button takes the whole
     *    app full screen, windowed layout and all, and that is the mode they
     *    asked for, not a disagreement.
     *
     * Fed from two places, because the window outlives the page. Every state
     * change the window announces comes through the listener below; the read
     * on mount is for the announcement that was made before there was a page
     * to hear it — main pushes the state on `did-finish-load`, which is before
     * React has mounted this listener, so a renderer reload inside full screen
     * kept the window and lost the flag. Measured: 1440px tall with the
     * windowed layout in it, and a double-click that only repaired the
     * disagreement.
     */
    /** The last announcement's answer, to tell leaving from never having been. */
    let wasFullScreen = false;
    const reconcileWindowState = (state: Partial<IWindowState> | undefined) => {
      if (!mounted) {
        return;
      }
      setIsWindowMaximized(Boolean(state?.isMaximized));
      // What the window's own edge is drawn from (`body::after` in App.scss):
      // whether there is an edge to light at all, and the radius Windows
      // clips the corner to, which is in the system's pixels while the page
      // is in the zoom's. On the root element rather than in React state
      // because the player draws no React tree of the app's at all.
      const root = document.documentElement;
      root.classList.toggle(
        'is-window-filled',
        state?.isMaximized === true || state?.isFullScreen === true,
      );
      const zoom = state?.zoom;
      if (typeof zoom === 'number' && zoom > 0) {
        root.style.setProperty('--window-zoom', String(zoom));
      }
      if (state?.isFullScreen === true) {
        wasFullScreen = true;
        if (
          !windowFullScreenClaimRef.current &&
          state.isSystemFullScreen !== true
        ) {
          window.electron.ipcRenderer
            .setWindowFullScreen(false)
            .catch(() => undefined);
        }
        return;
      }
      // Only on the way out, never merely while windowed: a claim written a
      // moment before the window has gone full screen for it is the page
      // entering the mode, and the announcement it is racing says nothing
      // about the claim.
      if (wasFullScreen && windowFullScreenClaimRef.current) {
        if (getGraphView() === 'fullscreen') {
          exitGraphFullScreen();
        }
        setPlayerVisFull(false);
      }
      wasFullScreen = false;
      mediaFullScreenRequestedRef.current = false;
      setMediaFullScreenOwner(undefined);
    };

    window.electron.ipcRenderer
      .getWindowState()
      .then(reconcileWindowState)
      .catch(() => {
        // The window state is only visual; keep the restore control usable if
        // the main process is not ready during a hot reload.
      });

    const unsubscribe = window.electron.ipcRenderer.on(
      'window-state-changed',
      (...args: unknown[]) => {
        reconcileWindowState(args[0] as Partial<IWindowState> | undefined);
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const toggleMaximizeWindow = async () => {
    const maximized = await window.electron.ipcRenderer.toggleMaximizeWindow();
    setIsWindowMaximized(maximized);
  };

  /** Out of full screen, whichever kind of full screen it is. */
  const leaveFullScreen = useCallback(() => {
    if (isMediaFullScreen) {
      applyMediaFullScreen(undefined).catch(() => undefined);
      return;
    }
    exitGraphFullScreen();
  }, [applyMediaFullScreen, isMediaFullScreen]);

  return {
    mediaFullScreenOwner,
    isMediaFullScreen,
    isGraphAppFullScreen,
    isAppFullScreen,
    /** As large as it goes, by either route. */
    isWindowFilled: isWindowMaximized || isAppFullScreen,
    hasFullScreenTopBar,
    isChromeHidden,
    isChromeIdle,
    isPointerNearChrome,
    applyMediaFullScreen,
    releaseMediaSurface,
    leaveFullScreen,
    toggleMaximizeWindow,
  };
};

export default useShellFullScreen;
