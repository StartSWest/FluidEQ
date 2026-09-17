import type { Display, WebContents } from 'electron';
import log from 'electron-log';
import type { IScenePerformance } from '../../common/scenePerformance';
import type {
  IWallpaperChoice,
  IWallpaperScreen,
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
  /** Why a monitor should not play now, given whether an app fills it. */
  pauseReason(fullscreen: boolean): TWallpaperPause | undefined;
  /** The window's frame rate and resolution choice, as it is now. */
  performance(): IScenePerformance;
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
  const failures = new Map<number, IMonitorFailure>();
  // Set once by the owner, which publishes the state these maps make up.
  let changed: () => void = () => undefined;

  const remove = (displayId: number) => {
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
    remove(display.id);
    failures.delete(display.id);
    const executable = options.executable();
    if (!executable) {
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
        executable,
        pauseReason: options.pauseReason,
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
      failures.set(display.id, { choice, error: 'renderer' });
      return;
    }
    // A surface that failed while it was being built has recorded why.
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
    surfaceFor: (contents: WebContents) =>
      [...surfaces.values()].find((surface) => surface.owns(contents)),
    applyPolicy: () => surfaces.forEach((surface) => surface.applyPolicy()),
    /** The window's choice changed: every monitor playing follows it. */
    retunePerformance: (next: IScenePerformance) =>
      surfaces.forEach((surface) => surface.retunePerformance(next)),
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
      failures.clear();
    },
  };
};
