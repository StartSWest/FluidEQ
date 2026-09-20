import type { Display, WebContents } from 'electron';
import log from 'electron-log';
import type { IScenePerformance } from '../../common/scenePerformance';
import type {
  IWallpaperChoice,
  IWallpaperScreen,
  IWallpaperTuning,
  TWallpaperError,
  TWallpaperPause,
} from '../../common/wallpaper';
import {
  createDesktopSurface,
  type IDesktopSurface,
  type IWallpaperScene,
} from './surface';

export interface IMonitorFailure {
  choice: IWallpaperChoice;
  error: TWallpaperError;
}

interface IMonitorBackgroundsOptions {
  /** The desktop helper, when this build has one. */
  executable(): string | undefined;
  /**
   * Why a monitor should not play now, given whether anything of its
   * desktop can still be seen.
   */
  pauseReason(covered: boolean): TWallpaperPause | undefined;
  /** The window's frame rate and resolution choice, as it is now. */
  performance(): IScenePerformance;
  /** What the listener set for one visualizer, as it is now. */
  tuning(lookId: string): IWallpaperTuning | undefined;
  /** The last surface has gone. */
  onEmpty(): void;
}

/**
 * Each monitor's surface, or the reason it has none. A failure is kept until
 * that monitor is started again or stopped, so the window can say which
 * monitor failed and why — and so a retry keeps the wave and motion it was
 * set with.
 */
export const createMonitorBackgrounds = (
  options: IMonitorBackgroundsOptions,
) => {
  const surfaces = new Map<number, IDesktopSurface>();
  /**
   * The background a monitor is still showing while its replacement loads.
   * It is off the list the window is told about — what that says is what the
   * monitor is coming to — but it is still drawing, still served its audio,
   * and still paused with the rest.
   */
  const leaving = new Map<number, IDesktopSurface>();
  const failures = new Map<number, IMonitorFailure>();
  // Set once by the owner, which publishes the state these maps make up.
  let changed: () => void = () => undefined;

  const letGo = (displayId: number) => {
    const surface = leaving.get(displayId);
    leaving.delete(displayId);
    surface?.release();
  };

  const remove = (displayId: number) => {
    letGo(displayId);
    const surface = surfaces.get(displayId);
    surfaces.delete(displayId);
    surface?.release();
    if (surface && surfaces.size === 0) {
      options.onEmpty();
    }
  };

  const fail = (
    displayId: number,
    choice: IWallpaperChoice,
    error: TWallpaperError,
  ) => {
    remove(displayId);
    failures.set(displayId, { choice, error });
  };

  const place = (
    display: Display,
    choice: IWallpaperChoice,
    scene: IWallpaperScene,
  ) => {
    // One visualizer replacing another — a look set again, a scene brought up
    // to date — used to take the old one off the desktop first, so the plain
    // wallpaper was on screen for as long as the new scene took to load and
    // compile. The one playing stays until the new one is on the desktop, or
    // has learned it must not be seen at all.
    const playing = surfaces.get(display.id);
    const handOver = playing?.phase() === 'running' ? playing : undefined;
    if (handOver) {
      letGo(display.id);
      surfaces.delete(display.id);
      leaving.set(display.id, handOver);
    } else {
      remove(display.id);
    }
    failures.delete(display.id);
    const executable = options.executable();
    if (!executable) {
      letGo(display.id);
      failures.set(display.id, { choice, error: 'unavailable' });
      return;
    }
    let surface: IDesktopSurface | undefined;
    try {
      surface = createDesktopSurface({
        displayId: display.id,
        bounds: display.bounds,
        choice,
        scene,
        performance: options.performance(),
        tuning: options.tuning(choice.lookId),
        executable,
        pauseReason: options.pauseReason,
        onReady: () => {
          // Only what this surface replaced, and only while it is still the
          // monitor's: a late report from one already replaced again must not
          // take its successor's predecessor away.
          if (surfaces.get(display.id) === surface) {
            letGo(display.id);
          }
        },
        onChange: () => changed(),
        onFail: (error) => {
          // A replaced surface reporting late must not remove its successor.
          if (surface && surfaces.get(display.id) !== surface) {
            return;
          }
          fail(display.id, surface?.choice() ?? choice, error);
          changed();
        },
      });
    } catch (error) {
      log.warn(`Desktop visualizer start: ${error}`);
      letGo(display.id);
      failures.set(display.id, { choice, error: 'renderer' });
      return;
    }
    // A surface that failed while it was being built has recorded why, and
    // took the one it was replacing with it.
    if (!failures.has(display.id)) {
      surfaces.set(display.id, surface);
    }
  };

  return {
    /** Hears what a surface changes on its own: its phase, or its failing. */
    onChange: (listener: () => void) => {
      changed = listener;
    },
    place,
    fail,
    /** Nothing on the monitor: no surface and no failure. */
    clear: (displayId: number) => {
      remove(displayId);
      failures.delete(displayId);
    },
    /** Every running surface failed for one reason; false when none ran. */
    failEverywhere: (error: TWallpaperError): boolean => {
      const running = [...surfaces.values()];
      running.forEach((surface) =>
        fail(surface.displayId, surface.choice(), error),
      );
      return running.length > 0;
    },
    surfaceOn: (displayId: number) => surfaces.get(displayId),
    lookOn: (displayId: number) => surfaces.get(displayId)?.lookId,
    surfaces: () => [...surfaces.values()],
    failures: () => [...failures],
    failureOn: (displayId: number) => failures.get(displayId),
    ids: () => [...surfaces.keys(), ...failures.keys()],
    // A background on its way out still draws, so its page is still answered:
    // the audio it reads, and the frames and failures it reports.
    surfaceFor: (contents: WebContents) =>
      [...surfaces.values(), ...leaving.values()].find((surface) =>
        surface.owns(contents),
      ),
    applyPolicy: () => {
      surfaces.forEach((surface) => surface.applyPolicy());
      leaving.forEach((surface) => surface.applyPolicy());
    },
    /** The window's choice changed: every monitor playing follows it. */
    retunePerformance: (next: IScenePerformance) =>
      surfaces.forEach((surface) => surface.retunePerformance(next)),
    /**
     * The listener tuned their visualizers: every monitor takes what belongs
     * to the look it shows, whichever monitors those are.
     */
    applyTuning: (tuningOf: (lookId: string) => IWallpaperTuning | undefined) =>
      surfaces.forEach((surface) =>
        surface.applyTuning(tuningOf(surface.lookId)),
      ),
    screens: (): IWallpaperScreen[] => [
      ...[...surfaces.values()].map((surface): IWallpaperScreen => ({
        displayId: surface.displayId,
        ...surface.choice(),
        phase: surface.phase(),
        pauseReason: surface.pauseReason(),
      })),
      ...[...failures].map(([displayId, failure]): IWallpaperScreen => ({
        displayId,
        ...failure.choice,
        phase: 'error',
        error: failure.error,
      })),
    ],
    dispose: () => {
      [...surfaces.keys()].forEach(remove);
      // A hand-over in flight on a monitor with nothing else on it: its window
      // outlives the app that put it there unless it is let go here too.
      [...leaving.keys()].forEach(letGo);
      failures.clear();
    },
  };
};
