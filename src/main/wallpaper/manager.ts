import {
  app,
  screen,
  type BrowserWindow,
  type Display,
  type WebContents,
} from 'electron';
import log from 'electron-log';
import {
  WALLPAPER,
  wallpaperPauseReason,
  type IWallpaperAudio,
  type IWallpaperChoice,
  type IWallpaperDisplay,
  type IWallpaperStart,
  type IWallpaperState,
  type TWallpaperError,
} from '../../common/wallpaper';
import {
  sameScenePerformance,
  type IScenePerformance,
} from '../../common/scenePerformance';
import type { IEntitlement } from '../account/entitlement';
import { isSceneFailure } from '../scenePackStore';
import {
  matchSavedScreens,
  savedMonitorOf,
  type IArrangementStore,
  type ISavedScreen,
} from './arrangement';
import createWallpaperAudioRelay from './audioRelay';
import { createMonitorBackgrounds } from './backgrounds';
import { watchDesktopConditions, type IDesktopConditions } from './conditions';
import { toWallpaperDisplays } from './displays';
import { wallpaperHostPath } from './nativeHost';
import type { IWallpaperScenes } from './scenes';
import type { IDesktopSurface } from './surface';

export interface IWallpaperDeps extends IWallpaperScenes {
  getMainWindow(): BrowserWindow | null;
  entitlement: IEntitlement;
  /** Where each monitor's background is remembered between launches. */
  arrangement: IArrangementStore;
}

/** Failures a monitor changing shape may clear. */
const RETRIED_ON_DISPLAY_CHANGE: readonly TWallpaperError[] = [
  'missing-display',
  'host',
  'renderer',
];

/**
 * Every monitor's background — what it shows, what it was last set to show,
 * kept between launches — and everything that starts, pauses or stops them:
 * the window's requests, the membership, the scenes, the monitors themselves
 * and the power state.
 */
export const createWallpaperManager = (deps: IWallpaperDeps) => {
  const remembered = deps.arrangement.read();
  let { pauseOnBattery, performance } = remembered;
  // What each monitor was set to show, by the id it is connected under now.
  // A failure or an unplugged cable leaves it here; only Stop takes it away.
  const saved = new Map<number, ISavedScreen>(
    remembered.screens.map((entry) => [entry.displayId, entry]),
  );
  let restorePending = saved.size > 0;
  let disposed = false;
  let conditions: Readonly<IDesktopConditions> = {
    locked: false,
    suspended: false,
    battery: false,
  };
  const relay = createWallpaperAudioRelay();
  const cleanups: (() => void)[] = [];
  const hookedOwners = new WeakSet<WebContents>();
  const supported = () => process.platform === 'win32';
  const entitled = () => deps.entitlement.status().state !== 'none';
  const ownerContents = () => {
    const window = deps.getMainWindow();
    return window && !window.isDestroyed() ? window.webContents : undefined;
  };
  // Nothing to arrange where the desktop cannot take a background, and the
  // physical conversion exists on Windows only.
  const connectedDisplays = (): IWallpaperDisplay[] =>
    supported() && app.isReady()
      ? toWallpaperDisplays(
          screen.getAllDisplays(),
          screen.getPrimaryDisplay().id,
          (rect) => screen.dipToScreenRect(null, rect),
        )
      : [];

  const backgrounds = createMonitorBackgrounds({
    executable: wallpaperHostPath,
    pauseReason: (fullscreen) =>
      wallpaperPauseReason({ ...conditions, pauseOnBattery, fullscreen }),
    performance: () => performance,
    onEmpty: () => relay.cancel(),
  });

  const state = (): IWallpaperState => ({
    supported: supported(),
    displays: connectedDisplays(),
    screens: backgrounds.screens(),
    pauseOnBattery,
  });

  const publish = () => {
    const owner = ownerContents();
    if (owner && !owner.isDestroyed()) {
      owner.send(WALLPAPER.changed, state());
    }
  };
  backgrounds.onChange(publish);

  const save = () => {
    try {
      deps.arrangement.write({
        pauseOnBattery,
        performance,
        screens: [...saved.values()],
      });
    } catch (error) {
      log.warn(`Desktop backgrounds could not be remembered: ${error}`);
    }
  };

  /**
   * The window's performance choice for visualizers — the frame rate, the
   * resolution and its floor, the scaler and the smoothing. One setting for
   * every monitor, kept with the backgrounds so a monitor started at the next
   * launch draws by it before the window has said a word.
   *
   * Every field, because the page draws by every field: comparing the rate
   * and the size alone left a background on the scaler and the smoothing it
   * started with, on the desktop and in the file, until something else moved.
   */
  const setPerformance = (next: IScenePerformance) => {
    if (disposed || sameScenePerformance(next, performance)) {
      return;
    }
    performance = next;
    save();
    backgrounds.retunePerformance(next);
  };

  const remember = (display: IWallpaperDisplay, choice: IWallpaperChoice) => {
    saved.set(display.id, {
      displayId: display.id,
      choice,
      monitor: savedMonitorOf(display),
    });
  };

  const failEverywhere = (error: TWallpaperError) => {
    if (backgrounds.failEverywhere(error)) {
      publish();
    }
  };

  const watchOwner = (owner: WebContents) => {
    if (hookedOwners.has(owner)) {
      return;
    }
    hookedOwners.add(owner);
    owner.once('destroyed', () => failEverywhere('audio'));
    // A reloading window never answers the read it was sent; letting go of
    // it keeps every monitor asking, and the new page answers the next one.
    owner.on('render-process-gone', () => relay.cancel());
    owner.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) {
        relay.cancel();
      }
    });
  };

  /** Starts what a monitor was set to show, or says why it cannot. */
  const restore = (display: Display, choice: IWallpaperChoice) => {
    const scene = entitled() ? deps.loadScene(choice.lookId) : undefined;
    if (scene) {
      backgrounds.place(display, choice, scene);
    } else {
      backgrounds.fail(
        display.id,
        choice,
        entitled() ? 'missing-scene' : 'not-entitled',
      );
    }
  };

  /** Puts remembered backgrounds on the connected monitors they match. */
  const bringBack = (
    waiting: readonly ISavedScreen[],
    displays: readonly IWallpaperDisplay[],
  ) => {
    const { matches, missing } = matchSavedScreens(waiting, displays);
    const connected = screen.getAllDisplays();
    matches.forEach(({ saved: entry, display }) => {
      // Under the id the monitor has now, which a renumbering may have moved.
      saved.delete(entry.displayId);
      backgrounds.clear(entry.displayId);
      remember(display, entry.choice);
      const target = connected.find((candidate) => candidate.id === display.id);
      if (target && backgrounds.lookOn(display.id) !== entry.choice.lookId) {
        restore(target, entry.choice);
      }
    });
    return { matched: matches.length, missing };
  };

  /**
   * What was on the desktop before FluidEQ last closed, back on the same
   * monitors. It waits for the window, whose page answers the monitors' audio
   * reads, and for the membership, which the account may confirm after launch.
   */
  const restoreSaved = () => {
    const owner = ownerContents();
    if (
      !restorePending ||
      disposed ||
      !supported() ||
      !app.isReady() ||
      !owner ||
      !entitled()
    ) {
      return;
    }
    restorePending = false;
    watchOwner(owner);
    const { missing } = bringBack([...saved.values()], connectedDisplays());
    // Still remembered, and listed as waiting for its monitor, with a Stop.
    missing.forEach((entry) =>
      backgrounds.fail(entry.displayId, entry.choice, 'missing-display'),
    );
    save();
    publish();
  };

  /** Remembered monitors that could not start for one of `errors`, again. */
  const retryWaiting = (errors: readonly TWallpaperError[]): boolean => {
    if (disposed || !app.isReady() || !entitled()) {
      return false;
    }
    const connected = screen.getAllDisplays();
    let changed = false;
    backgrounds.failures().forEach(([displayId, failure]) => {
      const display = connected.find((entry) => entry.id === displayId);
      const scene =
        display && saved.has(displayId) && errors.includes(failure.error)
          ? deps.loadScene(failure.choice.lookId)
          : undefined;
      if (display && scene) {
        backgrounds.place(display, failure.choice, scene);
        changed = true;
      }
    });
    return changed;
  };

  const start = (request: IWallpaperStart) => {
    if (disposed) {
      return;
    }
    const { displayIds, lookId, wave, motion } = request;
    // Rebuilt field by field: what is kept, sent back and written to disk is
    // exactly these numbers, whatever else the request carried.
    const choice: IWallpaperChoice = {
      lookId,
      wave: { height: wave.height, position: wave.position },
      motion,
    };
    pauseOnBattery = request.pauseOnBattery;
    const owner = ownerContents();
    const scene = entitled() ? deps.loadScene(lookId) : undefined;
    if (!supported() || !entitled() || !owner || !scene) {
      let reason: TWallpaperError;
      if (!supported()) {
        reason = 'unsupported';
      } else if (!entitled()) {
        reason = 'not-entitled';
      } else if (!owner) {
        reason = 'audio';
      } else {
        reason = 'missing-scene';
      }
      displayIds.forEach((id) => backgrounds.fail(id, choice, reason));
    } else {
      watchOwner(owner);
      const connected = screen.getAllDisplays();
      const displays = connectedDisplays();
      displayIds.forEach((id) => {
        const target = connected.find((entry) => entry.id === id);
        const display = displays.find((entry) => entry.id === id);
        if (!target || !display) {
          backgrounds.fail(id, choice, 'missing-display');
          return;
        }
        const playing = backgrounds.surfaceOn(id);
        if (playing?.lookId === lookId) {
          // Set again with another wave or motion: the one already playing
          // takes it, with no restart and no blink.
          playing.retune(choice);
        } else {
          backgrounds.place(target, choice, scene);
        }
        // Remembered once it is on the monitor: a request refused outright
        // is not something to bring back at the next launch.
        if (backgrounds.lookOn(id) === lookId) {
          remember(display, choice);
        }
      });
    }
    save();
    // The battery choice is one setting, so monitors already playing follow it.
    backgrounds.applyPolicy();
    publish();
  };

  const stop = (displayIds: readonly number[] | undefined) => {
    if (disposed) {
      return;
    }
    const ids = displayIds ?? [
      ...new Set([...backgrounds.ids(), ...saved.keys()]),
    ];
    ids.forEach((id) => {
      backgrounds.clear(id);
      saved.delete(id);
    });
    save();
    publish();
  };

  /**
   * A desktop page that could not draw. When the scene itself failed — its
   * code would not compile, or the GPU reset under one of its own frames —
   * the monitor says it was refused and the failure is written down with the
   * graph's. Kept as a renderer failure, a monitor changing shape or the next
   * launch ran the same code again, and a scene that resets the graphics
   * driver a few times a minute takes Windows down with it.
   */
  const surfaceFailed = (surface: IDesktopSurface, reason: unknown) => {
    if (!isSceneFailure(reason)) {
      surface.fail('renderer');
      return;
    }
    surface.fail('refused');
    deps.reportSceneFailure(surface.lookId, reason);
  };

  const refreshScenes = () => {
    restoreSaved();
    if (disposed || !app.isReady()) {
      return;
    }
    // A visualizer installed again — or member scenes that finished loading
    // after launch — brings back the monitors that were waiting for it. Not a
    // refused one: that waits for the next launch or for somebody to set it,
    // so a scene that failed here is never started again on its own.
    let changed = retryWaiting(['missing-scene']);
    const connected = screen.getAllDisplays();
    backgrounds.surfaces().forEach((surface) => {
      const next = deps.loadScene(surface.lookId);
      if (!next) {
        backgrounds.fail(surface.displayId, surface.choice(), 'missing-scene');
        changed = true;
        return;
      }
      const display = connected.find((entry) => entry.id === surface.displayId);
      // An updated scene replaces the one on the desktop, as in the graph.
      if (
        display &&
        (next.pack.version !== surface.scene.pack.version ||
          next.pack.source !== surface.scene.pack.source)
      ) {
        backgrounds.place(display, surface.choice(), next);
        changed = true;
      }
    });
    if (changed) {
      publish();
    }
  };

  const displayAdded = () => {
    // A monitor plugged back in gets back the background it had.
    const waiting = backgrounds
      .failures()
      .filter(
        ([displayId, failure]) =>
          failure.error === 'missing-display' && saved.has(displayId),
      )
      .flatMap(([displayId]) => saved.get(displayId) ?? []);
    if (waiting.length > 0 && entitled()) {
      // Never onto a monitor that has a background of its own already.
      const waitingIds = new Set(waiting.map((entry) => entry.displayId));
      const taken = new Set([
        ...backgrounds.surfaces().map((surface) => surface.displayId),
        ...[...saved.keys()].filter((id) => !waitingIds.has(id)),
      ]);
      const { matched } = bringBack(
        waiting,
        connectedDisplays().filter((display) => !taken.has(display.id)),
      );
      if (matched > 0) {
        save();
      }
    }
    publish();
  };
  const displayRemoved = (_event: unknown, display: Display) => {
    const surface = backgrounds.surfaceOn(display.id);
    if (surface) {
      backgrounds.fail(display.id, surface.choice(), 'missing-display');
    }
    publish();
  };
  const displayMetricsChanged = (
    _event: unknown,
    display: Display,
    changedMetrics: string[],
  ) => {
    // The work area moves with the taskbar and changes nothing drawn here.
    if (
      changedMetrics.includes('bounds') ||
      changedMetrics.includes('scaleFactor')
    ) {
      const surface = backgrounds.surfaceOn(display.id);
      const failure = backgrounds.failureOn(display.id);
      if (surface) {
        restore(display, surface.choice());
      } else if (failure && RETRIED_ON_DISPLAY_CHANGE.includes(failure.error)) {
        restore(display, failure.choice);
      }
    }
    publish();
  };

  cleanups.push(
    deps.entitlement.subscribe(() => {
      if (!entitled()) {
        failEverywhere('not-entitled');
        return;
      }
      restoreSaved();
      // A membership back after lapsing brings back what it had stopped.
      if (retryWaiting(['not-entitled', 'missing-scene'])) {
        publish();
      }
    }),
    deps.subscribeScenes(refreshScenes),
  );
  app
    .whenReady()
    .then(() => {
      if (disposed) {
        return undefined;
      }
      const watched = watchDesktopConditions(() => {
        backgrounds.applyPolicy();
        publish();
      });
      conditions = watched.conditions;
      screen.on('display-added', displayAdded);
      screen.on('display-removed', displayRemoved);
      screen.on('display-metrics-changed', displayMetricsChanged);
      cleanups.push(() => {
        watched.dispose();
        screen.removeListener('display-added', displayAdded);
        screen.removeListener('display-removed', displayRemoved);
        screen.removeListener('display-metrics-changed', displayMetricsChanged);
      });
      return undefined;
    })
    .catch((error: unknown) =>
      log.warn(`Desktop lifecycle unavailable: ${error}`),
    );

  return {
    state,
    start,
    stop,
    setPerformance,
    restoreSaved,
    failEverywhere,
    surfaceFailed,
    entitled,
    ownerContents,
    surfaceFor: backgrounds.surfaceFor,
    /**
     * One read serves every monitor asking for the same frame. A calm
     * background is never given the music, whatever its page asks for.
     */
    requestAudio: (
      surface: IDesktopSurface,
    ): Promise<IWallpaperAudio | undefined> | undefined => {
      const owner = ownerContents();
      return surface.phase() !== 'paused' &&
        surface.choice().motion === 'music' &&
        owner
        ? relay.request(owner)
        : undefined;
    },
    acceptAudio: (raw: unknown) => relay.accept(raw),
    /** Reads sent before the page was listening were never answered. */
    audioReady: () => relay.cancel(),
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      backgrounds.dispose();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
};
