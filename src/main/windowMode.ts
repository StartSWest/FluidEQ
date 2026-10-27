/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { BrowserWindow, screen } from 'electron';
import {
  appMinimumSize,
  centreIn,
  clampInto,
  isPlayerRect,
  isUsableRect,
  playerFirstSize,
  playerMinimumSize,
} from '../common/windowMode';
import type { IRect, TWindowMode } from '../common/windowMode';
import { createFullScreenOwner } from './fullScreenOwner';
import { setWindowTransitions } from './windowDwm';
import unmaximizeLinuxWindow from './linux/linuxWindowRestore';
import keepLinuxWindowTopVisible from './linux/linuxWindowTop';
import linuxPlayerBounds from './linux/linuxPlayerBounds';
import {
  holdLinuxWindowSize,
  linuxWindowSizeOf,
  releaseLinuxWindowSize,
} from './linux/linuxWindowSize';
import { appPlacementFromWindow, appReturnBounds } from './appWindowPlacement';
import type { IAppPlacement } from './appWindowPlacement';

export type { IAppPlacement } from './appWindowPlacement';

/** Everything about the two modes worth keeping between launches. */
export interface IWindowModeMemory {
  mode: TWindowMode;
  /** The player's Always on top. Kept while the window is the app, too. */
  isPinned: boolean;
  /** The full app's normal bounds, to go back to from the player. */
  app: IAppPlacement;
  /**
   * Where the amp was left: the next switch to it opens it there and at that
   * height, the app and the player being two windows to the listener. Its
   * width is always the amp's own (`playerMinimumSize`).
   */
  player: Partial<IRect>;
}

const workAreaOf = (rect: IRect): IRect =>
  screen.getDisplayMatching(rect).workArea;

/**
 * A window size no screen reaches, for "no ceiling": said as a number rather
 * than leaning on what 0 means to each platform's size constraints.
 */
const NO_CEILING = 32_767;

/**
 * The switch between the full app and the player, and the floor each keeps.
 *
 * The two are one window. The player is not a second window floating beside a
 * hidden app: every provider, the engine, the Library's deck and the Media
 * page's player stay exactly where they are, and only what is drawn changes.
 * So switching is a matter of the window's size and its limits, which is the
 * main process's business and nobody else's.
 *
 * Each mode has its own floor. The app's is 1024×800, or the whole work area
 * of a smaller screen (`appMinimumSize`), and it follows the window from
 * screen to screen; the player's is its own layout's, which is in CSS pixels
 * and so moves with the page's zoom.
 */
export const createWindowModes = (
  platform: NodeJS.Platform = process.platform,
) => {
  const memory: IWindowModeMemory = {
    mode: 'app',
    isPinned: false,
    app: {},
    player: {},
  };
  /** Where the amp was left. */
  const ownPlayer = () => memory.player;
  const boundsToKeep = (rect: IRect) =>
    platform === 'linux' ? linuxPlayerBounds(rect, ownPlayer()) : rect;
  const keepPlayer = (rect: IRect) => {
    memory.player = boundsToKeep(rect);
  };
  const fullScreen = createFullScreenOwner();
  // Set once by main, beside the function that tells the page (`listen`).
  let onChange: () => void = () => undefined;
  /**
   * The height the player is held to, in the page's CSS pixels, while nothing
   * in it can grow — the page says so (`limitPlayerHeight`). Its decks keep
   * their own heights, so there is nothing for a taller window to give them
   * and nothing a shorter one could take: the window is exactly its content.
   */
  let playerHeld: number | undefined;
  /**
   * The least tall the player may be, in the page's CSS pixels: what its
   * open decks need. The player draws no scrollbar, so a window under this
   * is a window with its equalizer cut off (Ivan, 2026-09-21).
   */
  let playerHeightFloor: number | undefined;
  /**
   * The width the amp's rows need on one line, in the page's CSS pixels, as
   * the page says (`PLAYER_WIDTH_NEED_CHANNEL`): the amp's one width rises
   * to it where it is more than the amp's own.
   */
  let playerWidthNeed: number | undefined;
  /** Whether the listener is dragging the window's edge (`followWindow`). */
  let isDragging = false;
  /**
   * Whether a switch is placing the window right now.
   *
   * Everything the switch does — unmaximising, moving, resizing — reaches
   * Windows as the same events a listener dragging the window would, and
   * the mode is already the new one when they arrive. Without this, coming
   * back from a maximised app wrote the APP's bounds down as where the
   * player was left, and the next switch opened the player the size of the
   * whole screen (Ivan, 2026-09-21).
   */
  let isSwitching = false;

  const zoomOf = (win: BrowserWindow) => win.webContents.getZoomFactor();

  /**
   * Whether the window's bounds right now are the player's own — where the
   * listener has it — and so worth writing down as where it was left.
   *
   * Not while the picture has the screen, whose bounds are the display's; not
   * while the window is maximised, which is the app's on its way in or out;
   * and not while a switch is placing it, when every move and resize is the
   * switch's. Each of those used to reach the window-state file as the
   * player's size, and the next switch opened the amp the size of the screen
   * (Ivan, 2026-09-28).
   */
  const isPlayersOwn = (win: BrowserWindow) =>
    !win.isDestroyed() &&
    memory.mode === 'player' &&
    !isSwitching &&
    !linuxWindowSizeOf(win) &&
    !win.isFullScreen() &&
    !win.isMaximized();

  /**
   * The amp's width in the window's own pixels: its one width at the page's
   * zoom, or what its rows need on one line if that is more, and never wider
   * than the screen it stands on.
   */
  const playerWidth = (win: BrowserWindow) => {
    const zoom = zoomOf(win);
    return Math.min(
      workAreaOf(win.getBounds()).width,
      Math.max(
        playerMinimumSize(zoom).width,
        Math.ceil((playerWidthNeed ?? 0) * zoom),
      ),
    );
  };

  /**
   * The height the player is held to, in the window's own pixels — the page's
   * CSS pixels at its zoom — never under the player's floor nor over the
   * screen it stands on.
   */
  const heldHeight = (win: BrowserWindow): number | undefined => {
    if (memory.mode !== 'player' || playerHeld === undefined) {
      return undefined;
    }
    const zoom = zoomOf(win);
    return Math.min(
      workAreaOf(win.getBounds()).height,
      Math.max(playerMinimumSize(zoom).height, Math.round(playerHeld * zoom)),
    );
  };

  /**
   * The player's floor height in the window's own pixels: its own, or what
   * its open decks need if that is taller, and never taller than the screen
   * it stands on.
   */
  const floorHeight = (win: BrowserWindow, own: number) => {
    if (memory.mode !== 'player' || playerHeightFloor === undefined) {
      return own;
    }
    return Math.min(
      workAreaOf(win.getBounds()).height,
      Math.max(own, Math.round(playerHeightFloor * zoomOf(win))),
    );
  };

  /** Release the amp's frame and width ceiling before placing the full app. */
  const releaseAppLimits = (win: BrowserWindow) => {
    win.setResizable(true);
    win.setMaximizable(true);
    win.setMaximumSize(NO_CEILING, NO_CEILING);
  };

  /**
   * The limits of the mode the window is in, on the screen it is on now: its
   * floor, the height it is held to if it is held to one, and whether it can
   * be maximised. The player cannot — a double-click on its strip would
   * otherwise have filled the screen with a layout built for a corner of it,
   * and dragging it to the top edge would do the same.
   */
  const applyLimits = (
    win: BrowserWindow,
    // Said rather than read where the caller knows the window is ABOUT to be
    // full screen: on Windows the limits have to come off before it grows,
    // and at that moment the window still reports itself as an ordinary one.
    isFullScreen = win.isFullScreen(),
  ) => {
    if (win.isDestroyed()) {
      return;
    }
    const isPlayer = memory.mode === 'player';
    // A Mac's green button: full screen for the app, disabled on the player
    // (`macWindowOptions`) — except while the page is taking the screen for
    // the player's visualizer, which AppKit refuses a window that cannot go
    // full screen.
    if (platform === 'darwin') {
      win.setFullScreenable(!isPlayer || isFullScreen);
    }
    const floor = isPlayer
      ? playerMinimumSize(zoomOf(win))
      : appMinimumSize(workAreaOf(win.getBounds()));
    // A FULL-SCREEN WINDOW HAS NO LIMITS OF OURS ON IT (Ivan, 2026-09-22).
    // The visualizer takes the screen without leaving player mode, so every
    // limit here is the PLAYER's — the height it may not go under, its one
    // width — and none of them describe a window that is supposed to be
    // exactly the display. A ceiling under the screen's height
    // capped the picture; a floor measured while it was up held the window at
    // the work area's full height once it came back down.
    if (isFullScreen) {
      win.setMinimumSize(floor.width, floor.height);
      win.setMaximumSize(NO_CEILING, NO_CEILING);
      win.setMaximizable(!isPlayer);
      // Resizable for the length of it: AppKit takes no window full screen
      // that cannot be resized, and the amp is not resizable to the system
      // otherwise (below).
      win.setResizable(true);
      return;
    }
    // ONE WIDTH FOR THE AMP (Ivan, 2026-10-25: "no width resize"): its
    // floor and its ceiling, so only its height can be dragged.
    if (isPlayer) {
      const held = heldHeight(win);
      const width = playerWidth(win);
      const minHeight = held ?? floorHeight(win, floor.height);
      const transition = linuxWindowSizeOf(win);
      win.setMinimumSize(width, minHeight);
      // Linux's final compositor configure must not replace the remembered
      // height while the page is still drawing the newly placed amp.
      win.setMaximumSize(
        width,
        transition
          ? Math.max(minHeight, transition.height)
          : (held ?? NO_CEILING),
      );
      // NOT RESIZABLE TO WINDOWS, so no edge offers the sideways resize
      // cursor for a width that cannot change (Ivan, 2026-10-25: "don't show
      // x resize mouse icon on the width"); the amp's height is dragged by
      // its own grip along its foot (`PlayerHeightGrip`, `resizePlayer`).
      // A frameless window keeps its thick frame either way, so Windows still
      // rounds it and draws its shadow.
      win.setResizable(false);
    } else {
      releaseAppLimits(win);
      win.setMinimumSize(floor.width, floor.height);
    }
    if (isPlayer) {
      win.setMaximizable(false);
    }
  };

  /**
   * The window brought to the height it is held to, at least its floor, and
   * to the amp's one width.
   *
   * Never while the listener is dragging its edge: Windows owns the window's
   * size until the drag ends and applies the new limits on the drag's next
   * step by itself, so bounds set from here would only fight the pointer —
   * and are set again when the drag ends, with the width the window had when
   * they were asked for.
   */
  const fitPlayerBounds = (win: BrowserWindow) => {
    if (
      isDragging ||
      win.isDestroyed() ||
      win.isFullScreen() ||
      memory.mode !== 'player'
    ) {
      return;
    }
    const held = heldHeight(win);
    const bounds = win.getBounds();
    const own = playerMinimumSize(zoomOf(win));
    const width = playerWidth(win);
    const height =
      held ?? Math.max(bounds.height, floorHeight(win, own.height));
    if (bounds.height !== height || bounds.width !== width) {
      win.setBounds(
        clampInto({ ...bounds, width, height }, workAreaOf(bounds)),
      );
    }
  };

  /**
   * Out of full screen: the mode's limits back on, and the player back at the
   * bounds it went up from, to the pixel (`setFullScreen`).
   */
  const settleAfterFullScreen = (win: BrowserWindow) => {
    if (win.isDestroyed()) {
      return;
    }
    applyLimits(win, false);
    const left = ownPlayer();
    if (memory.mode === 'player' && isUsableRect(left)) {
      win.setBounds(clampInto(left, workAreaOf(left)));
    }
    onChange();
  };

  /** Always on top belongs to the player; the full app never stays over others. */
  const applyPin = (win: BrowserWindow) => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(memory.mode === 'player' && memory.isPinned);
    }
  };

  /**
   * Where the amp on screen opens: where it stood last time, its place as
   * well as its size (Ivan, 2026-09-21) — the modes are windows of their own
   * to the listener, and each comes back where they left it. The first time
   * there is nowhere to come back to, so it opens at its own narrow size in
   * the middle of the screen the window is on (Ivan, 2026-09-22), and so
   * does a player remembered as the whole screen, which nobody sized
   * (`isPlayerRect`).
   */
  const playerTarget = (win: BrowserWindow, onScreen: IRect): IRect => {
    const remembered = ownPlayer();
    // At the amp's one width, whatever width it was left at: an amp
    // remembered from before there was one width comes back at it, where it
    // stood.
    const { width } = playerMinimumSize(zoomOf(win));
    return isUsableRect(remembered) &&
      isPlayerRect(remembered, workAreaOf(remembered))
      ? clampInto({ ...remembered, width }, workAreaOf(remembered))
      : centreIn(playerFirstSize(zoomOf(win)), workAreaOf(onScreen));
  };

  /** Resolves once the window stands at the player's size. */
  const enterPlayer = (win: BrowserWindow): Promise<void> => {
    const onScreen = win.getBounds();
    memory.app = appPlacementFromWindow(win, memory.app);
    // Persist the full app before any amp resize can reach the window.
    onChange();
    const target = playerTarget(win, onScreen);
    memory.mode = 'player';
    isSwitching = true;
    const settle = () => {
      // Switched back while Windows was still restoring the window: the
      // app's bounds are already in place, and these would undo them.
      if (win.isDestroyed() || memory.mode !== 'player') {
        isSwitching = false;
        return;
      }
      // The floor comes down first, or the app's own holds the window at the
      // width it is leaving.
      if (platform === 'linux') {
        holdLinuxWindowSize(win, target, () => {
          applyLimits(win);
          onChange();
        });
      }
      applyLimits(win);
      win.setBounds(target);
      applyPin(win);
      // What the switch just set is where the player stands; the events it
      // is about to raise are the switch and not the listener.
      keepPlayer(target);
      isSwitching = false;
      onChange();
    };
    if (!win.isMaximized()) {
      settle();
      return Promise.resolve();
    }
    if (platform === 'linux') {
      return unmaximizeLinuxWindow(win).then(settle);
    }
    // Windows restores the window on its own message loop; its bounds are
    // only the window's to change once that has happened, which is what the
    // event says. Without Windows' shrink on the way (`setWindowTransitions`).
    return new Promise((resolve) => {
      win.once('unmaximize', () => {
        settle();
        setWindowTransitions(win, true);
        resolve();
      });
      setWindowTransitions(win, false);
      win.unmaximize();
    });
  };

  /** Resolves once the window stands as the full app again. */
  const leavePlayer = (win: BrowserWindow): Promise<void> => {
    releaseLinuxWindowSize(win);
    const onScreen = win.getBounds();
    // The size the listener left the player at, to open it at next time —
    // unless the window is not the player's yet: pressed back while the
    // switch in was still waiting for Windows to restore a maximised app,
    // these were the app's maximised bounds.
    if (isPlayersOwn(win)) {
      keepPlayer(onScreen);
    }
    memory.mode = 'app';
    isSwitching = true;
    // The page says them again the next time it draws the player.
    playerHeld = undefined;
    playerHeightFloor = undefined;
    playerWidthNeed = undefined;
    const saved = memory.app;
    const target = appReturnBounds(saved, onScreen);
    memory.app = { ...target, isMaximized: saved.isMaximized };
    applyPin(win);
    // The amp's ceiling off first: its one width is its maximum as well as
    // its floor, and the app's bounds set under it came out the amp's width
    // (Ivan, 2026-10-25: "your width fix is screwing my full app").
    releaseAppLimits(win);
    // Out to the app's size before its floor goes up: the other way round the
    // floor pushes the player's small window wide from where it stands, off
    // the edge of the screen when it stands near one.
    win.setBounds(target);
    applyLimits(win);
    if (!saved.isMaximized) {
      isSwitching = false;
      onChange();
      return Promise.resolve();
    }
    // Windows maximises on its own message loop, and the switch is not over
    // until it has: pressed twice in quick succession, the switch back read
    // a window that was not maximised YET, placed the player, and Windows
    // then maximised it — a player the size of the screen. Without Windows'
    // grow on the way (`setWindowTransitions`).
    return new Promise((resolve) => {
      win.once('maximize', () => {
        setWindowTransitions(win, true);
        isSwitching = false;
        onChange();
        resolve();
      });
      setWindowTransitions(win, false);
      win.maximize();
    });
  };

  return {
    /** What to do after every switch: write it down and tell the page. */
    listen: (next: () => void) => {
      onChange = next;
    },

    /** A copy of what there is to remember, for the window-state file. */
    memory: (): IWindowModeMemory => ({
      ...memory,
      app: { ...memory.app },
      player: { ...memory.player },
    }),

    /**
     * Where the player stands, for the window-state file, which is written on
     * every frame of a drag: the window's own bounds while they are the
     * player's (`isPlayersOwn`), and where it was last left otherwise. The
     * file used to take the window's bounds whenever the mode was the
     * player's, full screen and switches included — which is how the amp
     * came to be remembered as the size of the screen.
     */
    playerBounds: (win: BrowserWindow): Partial<IRect> =>
      isPlayersOwn(win) ? boundsToKeep(win.getBounds()) : memory.player,

    /** Which of the two the window is now. */
    mode: (): TWindowMode => memory.mode,

    /** What the file said, before the window is built from it. */
    restore: (saved: IWindowModeMemory) => {
      memory.mode = saved.mode;
      memory.isPinned = saved.isPinned;
      memory.app = { ...saved.app };
      memory.player = { ...saved.player };
    },

    applyLimits,
    applyPin,

    /**
     * Into the player or back to the app, answered once the window has the
     * new mode's size. Refused in full screen, where there is no window size
     * to change and no titlebar to have pressed.
     */
    setMode: async (
      win: BrowserWindow,
      next: TWindowMode,
    ): Promise<TWindowMode> => {
      if (next === memory.mode || win.isFullScreen()) {
        return memory.mode;
      }
      if (next === 'player') {
        await enterPlayer(win);
      } else {
        await leavePlayer(win);
      }
      return memory.mode;
    },

    /**
     * The picture on the whole screen, and back to exactly the window that
     * was there before it.
     *
     * Both halves are this module's business because both are about the
     * window's SIZE. Going up, the player's limits have to be lifted before
     * Windows grows the window — a ceiling of the decks' height would hold
     * the "full screen" at the size of an amp. Coming back down, the window
     * is put back at the bounds it left from, to the pixel, because the page
     * spends the whole of full screen measuring a layout that is the
     * screen's and saying so, and none of those numbers are the player's
     * (Ivan, 2026-09-22: "coming back from fullscreen needs to restore app
     * size exactly as it was").
     *
     * The order below is Windows': `setFullScreen` moves the window inside
     * the call, and the window's own `enter-full-screen` / `leave-full-screen`
     * events are raised BEFORE it does — so nothing that has to happen after
     * the move can be done from them. A Mac is the other way round: it
     * animates out on its own time and refuses new bounds until it has
     * finished, which its `leave-full-screen` says (`followWindow`).
     *
     * A full screen the listener chose from the system is not the page's to
     * end (`fullScreenOwner.ts`): asked to leave it, the window stays.
     */
    setFullScreen: (win: BrowserWindow, next: boolean): boolean => {
      if (win.isDestroyed()) {
        return false;
      }
      if (next === win.isFullScreen()) {
        return next;
      }
      if (next) {
        if (memory.mode === 'player') {
          keepPlayer(win.getBounds());
        }
        applyLimits(win, true);
        fullScreen.asked();
        win.setFullScreen(true);
        return true;
      }
      if (fullScreen.isSystem()) {
        return true;
      }
      win.setFullScreen(false);
      if (platform !== 'darwin') {
        settleAfterFullScreen(win);
      }
      return false;
    },

    /** Whether the listener chose the full screen the window is in. */
    isSystemFullScreen: () => fullScreen.isSystem(),

    /**
     * The window, back in the middle of the screen it is nearest.
     *
     * The way out of a window nobody can reach: a player dragged almost
     * entirely off the side, one left on a screen that has since been
     * unplugged, or one opened at a remembered place a change of displays has
     * put out of reach. `followWindow` already pulls a DRAGGED player back
     * inside the work area, but nothing reaches a window the pointer cannot
     * get to, so this is offered from the tray (Ivan, 2026-09-22).
     *
     * Written down as well as moved, or the player would open back in the
     * unreachable place next time.
     */
    recentre: (win: BrowserWindow) => {
      if (win.isDestroyed() || win.isFullScreen()) {
        return;
      }
      if (win.isMaximized()) {
        win.unmaximize();
      }
      const bounds = win.getBounds();
      const placed = centreIn(bounds, workAreaOf(bounds));
      win.setBounds(placed);
      if (memory.mode === 'player') {
        keepPlayer(placed);
      } else {
        memory.app = { ...memory.app, ...placed, isMaximized: false };
      }
      onChange();
    },

    setPinned: (win: BrowserWindow, isPinned: boolean) => {
      memory.isPinned = isPinned;
      applyPin(win);
      onChange();
    },

    /**
     * The height the player is to be held to, in the page's CSS pixels, or
     * none. Only the player is ever held: a height asked for while the window
     * is the app is dropped, because the app's own decks all grow.
     */
    limitPlayerHeight: (
      win: BrowserWindow,
      cssHeight: number | undefined,
      cssFloor: number | undefined,
    ) => {
      // NOT A WORD OF IT WHILE THE PICTURE HAS THE SCREEN. The page is laid
      // out at the size of the display then, so what it measures is the
      // display: taken as the player's floor, it held the window at the work
      // area's full height for the rest of the session once full screen was
      // left (Ivan, 2026-09-22). What the player was held to before it went
      // up is what it is held to when it comes back down.
      if (win.isFullScreen()) {
        return;
      }
      const isPlayer = memory.mode === 'player';
      playerHeld = isPlayer ? cssHeight : undefined;
      playerHeightFloor = isPlayer ? cssFloor : undefined;
      applyLimits(win);
      fitPlayerBounds(win);
    },

    /**
     * The width the amp's rows need on one line, in the page's CSS pixels:
     * the amp's one width rises to it, and comes back down when it is less.
     * Never while the picture has the screen, where what the page measures is
     * the display.
     */
    needPlayerWidth: (win: BrowserWindow, cssWidth: number | undefined) => {
      if (win.isFullScreen()) {
        return;
      }
      playerWidthNeed = memory.mode === 'player' ? cssWidth : undefined;
      applyLimits(win);
      fitPlayerBounds(win);
    },

    /**
     * Follow the window for as long as it lives: the listener dragging its
     * edge, and where the player is left standing.
     *
     * Windows/macOS leave movement to the system and the pointer, exactly as
     * for any other window — an edge stop
     * and a guard against Windows' own snap were both tried on 2026-09-22
     * and both fought the drag in ways nobody could live with, and Ivan
     * took them out by name ("remove all logic, leave electron behaves
     * naturally"). Do not put either back on those platforms. Linux alone
     * keeps the top below the desktop panel: its frameless caption could
     * otherwise be dragged out of reach (Ivan, 2026-10-23).
     *
     * What is done: the height the player is held to is put right after a
     * drag of its edge rather than in the middle of one (`fitPlayerBounds`),
     * and the player's own bounds are written down as they change rather
     * than only when the window leaves the mode, so a player closed as a
     * player opens again where it was.
     */
    followWindow: (win: BrowserWindow) => {
      if (platform === 'linux') {
        const keepTop = () => {
          if (!isSwitching) {
            keepLinuxWindowTopVisible(win);
          }
        };
        win.on('move', keepTop);
        win.on('resize', keepTop);
        screen.on('display-metrics-changed', keepTop);
        win.once('closed', () =>
          screen.off('display-metrics-changed', keepTop),
        );
      }
      const remember = () => {
        // NOT WHILE THE WINDOW IS FULL SCREEN, MAXIMISED OR SWITCHING. The
        // visualizer takes the whole screen without leaving player mode, so
        // every move and resize the transition raises arrived here as "this
        // is where the listener left the player" — and what got written down
        // was the size of the screen. Coming back out, the player was
        // restored to it (Ivan, 2026-09-22).
        if (isPlayersOwn(win)) {
          keepPlayer(win.getBounds());
        } else if (
          !win.isDestroyed() &&
          memory.mode === 'app' &&
          !isSwitching &&
          !win.isFullScreen()
        ) {
          memory.app = appPlacementFromWindow(win, memory.app);
        }
      };
      // These precede placement's save listeners. A mode flips to "app"
      // before its native resize completes; none of those intermediate amp
      // bounds may replace the full-app snapshot on disk.
      win.on('move', remember);
      win.on('resize', remember);
      win.on('maximize', remember);
      win.on('unmaximize', remember);
      win.on('will-resize', () => {
        isDragging = true;
      });
      win.on('resized', () => {
        isDragging = false;
        fitPlayerBounds(win);
        remember();
      });
      win.on('moved', remember);
      // The one thing that has to happen even when full screen was not asked
      // for through this module — the menu's F11, which exists in development
      // builds. The limits come off, or the "full screen" is capped at the
      // height the player's decks hold the window to. Coming back down needs
      // nothing here: the page says its layout again the moment it is a
      // player layout, and that puts the limits back (`limitPlayerHeight`).
      //
      // Before main's own listeners, which tell the page, so what they tell
      // it already says whose full screen this is.
      win.on('enter-full-screen', () => {
        fullScreen.entered();
        applyLimits(win, true);
      });
      win.on('leave-full-screen', () => {
        fullScreen.left();
        // A Mac has finished animating out by now, whoever asked — the page,
        // or the green button over a full screen the page took — and only
        // now takes the player's bounds back (`setFullScreen`).
        if (platform === 'darwin') {
          settleAfterFullScreen(win);
        }
      });
      remember();
    },

    /**
     * The player's height, in the page's CSS pixels.
     *
     * The page asks when a deck opens or closes, so the window grows and
     * shrinks with its decks, and to fold the player to one line and back.
     * The top edge stays put; a player standing at the foot of the screen is
     * pulled up rather than grown off it.
     *
     * A player held to its decks' height stays there: the page asks for the
     * new height and for the hold in the same breath, and either order has to
     * end at the same window. The fold lets the hold go before it asks.
     *
     * Dragged by its top edge (`fromTop`), the foot stays put instead and the
     * top follows the pointer; held at the floor, the top stops where the
     * floor puts it rather than sliding the whole window down.
     */
    resizePlayer: (win: BrowserWindow, cssHeight: number, fromTop = false) => {
      if (
        memory.mode !== 'player' ||
        win.isFullScreen() ||
        !Number.isFinite(cssHeight)
      ) {
        return;
      }
      const zoom = zoomOf(win);
      const bounds = win.getBounds();
      // Never under the amp's floor: with the window not resizable to
      // Windows, its own limits are no longer what stops the grip.
      const height =
        heldHeight(win) ??
        Math.max(
          floorHeight(win, playerMinimumSize(zoom).height),
          Math.round(cssHeight * zoom),
        );
      const y = fromTop ? bounds.y + bounds.height - height : bounds.y;
      win.setBounds(clampInto({ ...bounds, y, height }, workAreaOf(bounds)));
    },
  };
};

export type TWindowModes = ReturnType<typeof createWindowModes>;
