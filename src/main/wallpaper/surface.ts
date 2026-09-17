import type { Rectangle, WebContents } from 'electron';
import log from 'electron-log';
import type { IScenePack } from '../../common/scenePacks';
import type { IScenePerformance } from '../../common/scenePerformance';
import {
  WALLPAPER,
  type IWallpaperChoice,
  type IWallpaperSurfaceState,
  type TWallpaperError,
  type TWallpaperPause,
} from '../../common/wallpaper';
import { startWallpaperHost, type IWallpaperHost } from './nativeHost';
import { createWallpaperWindow, wallpaperUrl } from './window';

export interface IWallpaperScene {
  pack: IScenePack;
  member: boolean;
}

interface IDesktopSurfaceOptions {
  displayId: number;
  bounds: Rectangle;
  choice: IWallpaperChoice;
  scene: IWallpaperScene;
  /** The window's frame rate and resolution choice when the monitor starts. */
  performance: IScenePerformance;
  executable: string;
  /** Why this monitor should not play now, given whether an app fills it. */
  pauseReason(fullscreen: boolean): TWallpaperPause | undefined;
  /** Something this monitor's status shows has changed. */
  onChange(): void;
  /** At most once, after the surface has let go of its window and helper. */
  onFail(error: TWallpaperError): void;
}

export interface IDesktopSurface {
  readonly displayId: number;
  readonly lookId: string;
  readonly scene: IWallpaperScene;
  phase(): IWallpaperSurfaceState['phase'];
  pauseReason(): TWallpaperPause | undefined;
  /** What it shows, with its wave and motion as they are now. */
  choice(): IWallpaperChoice;
  /**
   * A new wave or motion for the visualizer already playing: the page moves
   * its band or changes what it hears, with no restart and no blink.
   */
  retune(next: Pick<IWallpaperChoice, 'wave' | 'motion'>): void;
  /** The window's frame rate and resolution choice changed: the page follows. */
  retunePerformance(next: IScenePerformance): void;
  surfaceState(): IWallpaperSurfaceState;
  owns(contents: WebContents): boolean;
  /** Re-reads the lock, sleep and battery conditions every monitor shares. */
  applyPolicy(): void;
  drawn(generation: unknown): void;
  fail(error: TWallpaperError): void;
  release(): void;
}

/**
 * One monitor's background: its own window, its own desktop helper and its
 * own pause state, so a full-screen game on one monitor pauses only that one.
 */
export const createDesktopSurface = (
  options: IDesktopSurfaceOptions,
): IDesktopSurface => {
  const { displayId, scene, executable } = options;
  const { lookId } = options.choice;
  const window = createWallpaperWindow(options.bounds);
  let host: IWallpaperHost | undefined;
  let released = false;
  let attached = false;
  let fullscreenKnown = false;
  let fullscreen = false;
  let shown = false;
  let frameReady = false;
  let renderGeneration = 1;
  let phase: IWallpaperSurfaceState['phase'] = 'starting';
  let pauseReason: TWallpaperPause | undefined;
  let { wave, motion } = options.choice;
  let { performance } = options;

  const surfaceState = (): IWallpaperSurfaceState => ({
    phase,
    renderGeneration,
    wave,
    motion,
    performance,
  });

  const release = () => {
    if (released) {
      return;
    }
    released = true;
    // EOF is the helper's signal to hide the window and let go of it.
    host?.stop();
    if (!window.isDestroyed()) {
      window.destroy();
    }
  };

  const fail = (error: TWallpaperError) => {
    if (released) {
      return;
    }
    release();
    options.onFail(error);
  };

  const tellPage = () => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(WALLPAPER.surfaceChanged, surfaceState());
    }
  };

  const applyPolicy = () => {
    // The helper reports whether an app fills the monitor right after placing
    // the window; showing before that report could flash over a game.
    if (released || !host || !attached || !fullscreenKnown) {
      return;
    }
    const reason = options.pauseReason(fullscreen);
    if (reason && phase !== 'paused') {
      // A new key makes the page draw afresh on resume even when React
      // coalesces the pause and the resume into one render.
      renderGeneration += 1;
      frameReady = false;
    }
    if (reason) {
      phase = 'paused';
    } else {
      phase = frameReady ? 'running' : 'starting';
    }
    pauseReason = reason;
    const visible = !reason && frameReady;
    host.setVisible(visible);
    if (visible && !shown) {
      shown = true;
      // Chromium marks a window's compositor visible only through its own show
      // path. Shown natively by the helper alone, the desktop got the window's
      // background colour and nothing else: the page drew, but no frame of it
      // was composited and its animation frames starved. Shown inactive once
      // it is a child behind the icons, it takes no focus and keeps its place;
      // pauses after this hide it through the helper.
      window.showInactive();
    }
    tellPage();
    options.onChange();
  };

  const drawn = (generation: unknown) => {
    if (released || generation !== renderGeneration || phase === 'paused') {
      return;
    }
    frameReady = true;
    if (host) {
      applyPolicy();
      return;
    }
    // Placed only once the scene has a frame, so the desktop never shows an
    // empty window while shaders compile.
    try {
      host = startWallpaperHost(
        executable,
        window.getNativeWindowHandle(),
        (message) => {
          if (released) {
            return;
          }
          if (message === 'error') {
            fail('host');
            return;
          }
          if (message === 'ready') {
            attached = true;
          } else {
            fullscreenKnown = true;
            fullscreen = message === 'paused';
          }
          applyPolicy();
        },
      );
    } catch (error) {
      log.warn(`Desktop visualizer attachment: ${error}`);
      fail('host');
    }
  };

  window.on('closed', () => fail('renderer'));
  window.webContents.on('render-process-gone', () => fail('renderer'));
  window.webContents.on(
    'did-fail-load',
    (_event, code, description, _url, mainFrame) => {
      // -3 is a load replaced by another, not a failure.
      if (mainFrame && code !== -3) {
        log.warn(`Desktop visualizer page: ${description}`);
        fail('renderer');
      }
    },
  );
  window.loadURL(wallpaperUrl()).catch((error: unknown) => {
    log.warn(`Desktop visualizer page: ${error}`);
    fail('renderer');
  });

  return {
    displayId,
    lookId,
    scene,
    phase: () => phase,
    pauseReason: () => pauseReason,
    choice: () => ({ lookId, wave, motion }),
    retunePerformance: (next) => {
      if (
        next.frameRate === performance.frameRate &&
        next.resolution === performance.resolution
      ) {
        return;
      }
      performance = next;
      tellPage();
    },
    retune: (next) => {
      if (
        next.wave.height === wave.height &&
        next.wave.position === wave.position &&
        next.motion === motion
      ) {
        return;
      }
      ({ wave, motion } = next);
      tellPage();
    },
    surfaceState,
    owns: (contents) =>
      !window.isDestroyed() && window.webContents === contents,
    applyPolicy,
    drawn,
    fail,
    release,
  };
};
