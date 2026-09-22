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
  isUsableRect,
  placeAtTopRight,
  playerFirstSize,
  playerMinimumSize,
} from '../common/windowMode';
import type { IRect, TWindowMode } from '../common/windowMode';

/** Where the full app was, as the window-state file keeps it. */
export interface IAppPlacement extends Partial<IRect> {
  isMaximized?: boolean;
}

/** Everything about the two modes worth keeping between launches. */
export interface IWindowModeMemory {
  mode: TWindowMode;
  /** The player's Always on top. Kept while the window is the app, too. */
  isPinned: boolean;
  /** The full app's normal bounds, to go back to from the player. */
  app: IAppPlacement;
  /** The player's bounds, whose size the next switch opens it at. */
  player?: Partial<IRect>;
}

const workAreaOf = (rect: IRect): IRect =>
  screen.getDisplayMatching(rect).workArea;

/** How much of a screen the app takes when there is nowhere to go back to. */
const APP_SCREEN_FRACTION = 0.9;

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
export const createWindowModes = () => {
  const memory: IWindowModeMemory = { mode: 'app', isPinned: false, app: {} };
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
   * The width the player's equalizer needs, in the page's CSS pixels — the
   * page says so from the band layout the listener has chosen. Narrower than
   * this and the faders lose the gap between them, so it is a floor and not
   * a preference.
   */
  let playerWidthFloor: number | undefined;
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
   * The player's floor width in the window's own pixels: its own, or the
   * equalizer's if that is wider, and never wider than the screen it stands
   * on — a band layout nobody can fit is still a window that must be usable.
   */
  const floorWidth = (win: BrowserWindow, own: number) => {
    if (memory.mode !== 'player' || playerWidthFloor === undefined) {
      return own;
    }
    return Math.min(
      workAreaOf(win.getBounds()).width,
      Math.max(own, Math.round(playerWidthFloor * zoomOf(win))),
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

  /**
   * The limits of the mode the window is in, on the screen it is on now: its
   * floor, the height it is held to if it is held to one, and whether it can
   * be maximised. The player cannot — a double-click on its strip folds it,
   * where Windows would otherwise have filled the screen with a layout built
   * for a corner of it, and dragging it to the top edge would do the same.
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
    const floor = isPlayer
      ? playerMinimumSize(zoomOf(win))
      : appMinimumSize(workAreaOf(win.getBounds()));
    // A FULL-SCREEN WINDOW HAS NO LIMITS OF OURS ON IT (Ivan, 2026-09-22).
    // The visualizer takes the screen without leaving player mode, so every
    // limit here is the PLAYER's — the height its decks hold it to, the width
    // its equalizer needs — and none of them describe a window that is
    // supposed to be exactly the display. A ceiling under the screen's height
    // capped the picture; a floor measured while it was up held the window at
    // the work area's full height once it came back down.
    if (isFullScreen) {
      win.setMinimumSize(floor.width, floor.height);
      win.setMaximumSize(NO_CEILING, NO_CEILING);
      win.setMaximizable(!isPlayer);
      return;
    }
    const held = heldHeight(win);
    win.setMinimumSize(
      floorWidth(win, floor.width),
      held ?? floorHeight(win, floor.height),
    );
    win.setMaximumSize(NO_CEILING, held ?? NO_CEILING);
    win.setMaximizable(!isPlayer);
  };

  /**
   * The window brought to the height it is held to and out to the width its
   * equalizer needs.
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
    const width = Math.max(bounds.width, floorWidth(win, own.width));
    const height =
      held ?? Math.max(bounds.height, floorHeight(win, own.height));
    if (bounds.height !== height || bounds.width !== width) {
      win.setBounds(
        clampInto({ ...bounds, width, height }, workAreaOf(bounds)),
      );
    }
  };

  /** Always on top belongs to the player; the full app never stays over others. */
  const applyPin = (win: BrowserWindow) => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(memory.mode === 'player' && memory.isPinned);
    }
  };

  /** Resolves once the window stands at the player's size. */
  const enterPlayer = (win: BrowserWindow): Promise<void> => {
    const onScreen = win.getBounds();
    memory.app = { ...win.getNormalBounds(), isMaximized: win.isMaximized() };
    // Where the player stood last time, its place as well as its size (Ivan,
    // 2026-09-21): the two modes are two windows to the listener, and each
    // comes back where they left it. The first time there is nowhere to come
    // back to, so it opens in the middle of the screen the app is on (Ivan,
    // 2026-09-22).
    const target = isUsableRect(memory.player)
      ? clampInto(memory.player, workAreaOf(memory.player))
      : centreIn(playerFirstSize(zoomOf(win)), workAreaOf(onScreen));
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
      applyLimits(win);
      win.setBounds(target);
      applyPin(win);
      // What the switch just set is where the player stands; the events it
      // is about to raise are the switch and not the listener.
      memory.player = target;
      isSwitching = false;
      onChange();
    };
    if (!win.isMaximized()) {
      settle();
      return Promise.resolve();
    }
    // Windows restores the window on its own message loop; its bounds are
    // only the window's to change once that has happened, which is what the
    // event says.
    return new Promise((resolve) => {
      win.once('unmaximize', () => {
        settle();
        resolve();
      });
      win.unmaximize();
    });
  };

  /** Resolves once the window stands as the full app again. */
  const leavePlayer = (win: BrowserWindow): Promise<void> => {
    const onScreen = win.getBounds();
    memory.player = onScreen;
    memory.mode = 'app';
    isSwitching = true;
    // The page says them again the next time it draws the player.
    playerHeld = undefined;
    playerHeightFloor = undefined;
    playerWidthFloor = undefined;
    const area = workAreaOf(onScreen);
    const saved = memory.app;
    const floor = appMinimumSize(area);
    // Where it was, pulled back onto a screen if that one has gone; the first
    // time, nine tenths of this screen from the corner the switch is in.
    const target = isUsableRect(saved)
      ? clampInto(saved, workAreaOf(saved))
      : placeAtTopRight(
          onScreen,
          {
            width: Math.max(
              floor.width,
              Math.round(area.width * APP_SCREEN_FRACTION),
            ),
            height: Math.max(
              floor.height,
              Math.round(area.height * APP_SCREEN_FRACTION),
            ),
          },
          area,
        );
    applyPin(win);
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
    // then maximised it — a player the size of the screen.
    return new Promise((resolve) => {
      win.once('maximize', () => {
        isSwitching = false;
        onChange();
        resolve();
      });
      win.maximize();
    });
  };

  return {
    /** What to do after every switch: write it down and tell the page. */
    listen: (next: () => void) => {
      onChange = next;
    },

    /** A copy of what there is to remember, for the window-state file. */
    memory: (): IWindowModeMemory => ({ ...memory, app: { ...memory.app } }),

    /** Which of the two the window is now. */
    mode: (): TWindowMode => memory.mode,

    /** What the file said, before the window is built from it. */
    restore: (saved: IWindowModeMemory) => {
      memory.mode = saved.mode;
      memory.isPinned = saved.isPinned;
      memory.app = { ...saved.app };
      memory.player = saved.player;
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
     * the move can be done from them.
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
          memory.player = win.getBounds();
        }
        applyLimits(win, true);
        win.setFullScreen(true);
        return true;
      }
      win.setFullScreen(false);
      applyLimits(win, false);
      if (memory.mode === 'player' && isUsableRect(memory.player)) {
        win.setBounds(clampInto(memory.player, workAreaOf(memory.player)));
      }
      onChange();
      return false;
    },

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
        memory.player = placed;
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
     * The width the player's equalizer needs, in the page's CSS pixels: the
     * window cannot be dragged narrower, and a window already narrower than
     * a band layout just chosen is widened to it.
     */
    floorPlayerWidth: (win: BrowserWindow, cssWidth: number | undefined) => {
      // Measured on a screen-wide layout while the picture is up, and no more
      // the player's than the height above it is.
      if (win.isFullScreen()) {
        return;
      }
      playerWidthFloor = memory.mode === 'player' ? cssWidth : undefined;
      applyLimits(win);
      fitPlayerBounds(win);
    },

    /**
     * Follow the window for as long as it lives: the listener dragging its
     * edge, and where the player is left standing.
     *
     * NOTHING HERE MOVES THE WINDOW. Where it goes is Windows' and the
     * pointer's business, exactly as for any other window — an edge stop
     * and a guard against Windows' own snap were both tried on 2026-09-22
     * and both fought the drag in ways nobody could live with, and Ivan
     * took them out by name ("remove all logic, leave electron behaves
     * naturally"). Do not put either back.
     *
     * What is done: the height the player is held to is put right after a
     * drag of its edge rather than in the middle of one (`fitPlayerBounds`),
     * and the player's own bounds are written down as they change rather
     * than only when the window leaves the mode, so a player closed as a
     * player opens again where it was.
     */
    followWindow: (win: BrowserWindow) => {
      const remember = () => {
        // NOT WHILE THE WINDOW IS FULL SCREEN. The visualizer takes the whole
        // screen without leaving player mode, so every move and resize the
        // transition raises arrived here as "this is where the listener left
        // the player" — and what got written down was the size of the screen.
        // Coming back out, the player was restored to it (Ivan, 2026-09-22).
        if (
          win.isDestroyed() ||
          win.isFullScreen() ||
          memory.mode !== 'player' ||
          isSwitching
        ) {
          return;
        }
        memory.player = win.getBounds();
      };
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
      win.on('enter-full-screen', () => applyLimits(win, true));
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
     */
    resizePlayer: (win: BrowserWindow, cssHeight: number) => {
      if (
        memory.mode !== 'player' ||
        win.isFullScreen() ||
        !Number.isFinite(cssHeight)
      ) {
        return;
      }
      const zoom = zoomOf(win);
      const bounds = win.getBounds();
      const height =
        heldHeight(win) ??
        Math.max(playerMinimumSize(zoom).height, Math.round(cssHeight * zoom));
      win.setBounds(clampInto({ ...bounds, height }, workAreaOf(bounds)));
    },
  };
};

export type TWindowModes = ReturnType<typeof createWindowModes>;
