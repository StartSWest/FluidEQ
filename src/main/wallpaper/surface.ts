import type { Rectangle, WebContents } from 'electron';
import log from 'electron-log';
import type { LocaleCode } from '../../common/i18n';
import type { TSceneMaker } from '../../common/sceneMaker';
import type { IScenePack } from '../../common/scenePacks';
import {
  sameScenePerformance,
  type IScenePerformance,
} from '../../common/scenePerformance';
import {
  sameSceneCameraControl,
  type ISceneCameraControl,
} from '../../common/sceneCameraControl';
import {
  WALLPAPER,
  answersMouse,
  monitorDaylight,
  type IWallpaperChoice,
  type IWallpaperSurfaceState,
  type IWallpaperTuning,
  type TWallpaperCover,
  type TWallpaperDaylight,
  type TWallpaperError,
  type TWallpaperPause,
} from '../../common/wallpaper';
import {
  startWallpaperHost,
  type IWallpaperHost,
  type TWallpaperHostEvent,
} from './nativeHost';
import { pointerDelivery, type TWallpaperPointer } from './pointerRelay';
import { createWallpaperWindow, wallpaperUrl } from './window';

/** The cover each of the helper's reports describes. */
const COVERS: Record<
  Exclude<TWallpaperHostEvent, 'ready' | 'error'>,
  TWallpaperCover
> = {
  active: 'none',
  paused: 'others',
  'paused-owner': 'window',
};

export interface IWallpaperScene {
  pack: IScenePack;
  /** Who made it, which is how its page runs it (`sceneRules.ts`). */
  madeBy: TSceneMaker;
}

interface IDesktopSurfaceOptions {
  displayId: number;
  bounds: Rectangle;
  choice: IWallpaperChoice;
  scene: IWallpaperScene;
  /** The window's frame rate and resolution choice when the monitor starts. */
  performance: IScenePerformance;
  /** How the window moves a scene's camera when the monitor starts. */
  cameraControl: ISceneCameraControl;
  /** What the listener set for this visualizer, when they set anything. */
  tuning: IWallpaperTuning | undefined;
  /**
   * The window's time of day as it is now, once the window has said it: a
   * monitor following the graph draws its scene at it, or reads the clock.
   */
  daylight(): TWallpaperDaylight | undefined;
  /** The window's Brightness as a time of day, once it has said it. */
  brightness(): number | undefined;
  /** The window's language, for the words the page shows. */
  locale(): LocaleCode;
  /**
   * The monitor's scale, physical pixels to the page's: the helper reports
   * the mouse in the first, the page is handed it in the second.
   */
  scale: number;
  executable: string;
  /**
   * Why this monitor should not play now, given what keeps its desktop out
   * of sight, if anything does.
   */
  pauseReason(cover: TWallpaperCover): TWallpaperPause | undefined;
  /**
   * Once, as soon as this surface is on the desktop — or has been told the
   * monitor is covered and it must not be seen at all. Whatever it replaced
   * can go now, and not before: that is what keeps the wallpaper off the
   * screen while a scene loads.
   */
  onReady(): void;
  /** Something this monitor's status shows has changed. */
  onChange(): void;
  /** At most once, after the surface has let go of its window and helper. */
  onFail(error: TWallpaperError): void;
}

export interface IDesktopSurface {
  readonly displayId: number;
  /** The monitor's rectangle this window was made for; another needs another window. */
  readonly bounds: Rectangle;
  /** What it shows now: `changeScene` moves both. */
  readonly lookId: string;
  readonly scene: IWallpaperScene;
  phase(): IWallpaperSurfaceState['phase'];
  pauseReason(): TWallpaperPause | undefined;
  /**
   * What it shows, with its wave, motion, following and own time of day as
   * they are now.
   */
  choice(): IWallpaperChoice;
  /**
   * A new wave or motion for the visualizer already playing: the page moves
   * its band or changes what it hears, with no restart and no blink. Following
   * the graph turned on or off is kept here too, and so is the monitor's own
   * time of day; each tells the page only the time of day that changes.
   */
  retune(
    next: Pick<
      IWallpaperChoice,
      'wave' | 'motion' | 'followsGraph' | 'daylight' | 'interactive'
    >,
  ): void;
  /** The window's frame rate and resolution choice changed: the page follows. */
  retunePerformance(next: IScenePerformance): void;
  /** The window's way of moving a camera changed: the page follows. */
  retuneCameraControl(next: ISceneCameraControl): void;
  /**
   * What the listener set for this visualizer — its controls, its timing and
   * the band it is drawn in — as the window has it now. The band becomes this
   * monitor's, so the list and the next launch show what is on the desktop.
   */
  applyTuning(next: IWallpaperTuning | undefined): void;
  /**
   * The window's time of day or its Brightness moved: a monitor whose time of
   * day comes from it tells its page, and the rest have nothing to change.
   */
  applyDaylight(): void;
  /** The window's language changed: the page's words follow it. */
  applyLocale(): void;
  /**
   * Another visualizer on this monitor — set by hand, the graph's that it
   * follows, a newer version of its own — drawn by the same page, which
   * keeps the one it shows until the new one has drawn and crossfades
   * (`sceneCrossfade.ts`). A new window here is what blinked the desktop:
   * the old one was destroyed the moment the new one was shown, before
   * Chromium had composited a frame of it, so the monitor showed the
   * window's background colour and then cut to the new scene.
   */
  changeScene(
    choice: IWallpaperChoice,
    scene: IWallpaperScene,
    tuning: IWallpaperTuning | undefined,
  ): void;
  surfaceState(): IWallpaperSurfaceState;
  owns(contents: WebContents): boolean;
  /** Re-reads the lock, sleep and battery conditions every monitor shares. */
  applyPolicy(): void;
  /** The page drew; true when it drew the scene this surface shows now. */
  drawn(generation: unknown): boolean;
  fail(error: TWallpaperError): void;
  release(): void;
}

/**
 * The same tuning, field by field: the window sends its whole record whenever
 * anything in it moves, and a page is told only when this look's part of it
 * actually changed.
 */
const sameTuning = (
  a: IWallpaperTuning | undefined,
  b: IWallpaperTuning | undefined,
): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * One monitor's background: its own window, its own desktop helper and its
 * own pause state, so windows covering one monitor pause only that one.
 */
export const createDesktopSurface = (
  options: IDesktopSurfaceOptions,
): IDesktopSurface => {
  const { displayId, bounds, executable } = options;
  let { scene } = options;
  let { lookId } = options.choice;
  const window = createWallpaperWindow(bounds);
  let host: IWallpaperHost | undefined;
  let released = false;
  let attached = false;
  let coverKnown = false;
  let cover: TWallpaperCover = 'none';
  let shown = false;
  let ready = false;
  let frameReady = false;
  // The page's key for its scene. A pause never moves it — nothing is hidden
  // while it waits, and the scene it keeps is the one that comes back — and
  // another visualizer raises it (`changeScene`): the page asks for the scene
  // again and crossfades to it, and a frame reported for an older one is not
  // this one's.
  let renderGeneration = 1;
  let phase: IWallpaperSurfaceState['phase'] = 'starting';
  let pauseReason: TWallpaperPause | undefined;
  let { wave, motion } = options.choice;
  let followsGraph = options.choice.followsGraph === true;
  let ownDaylight = options.choice.daylight;
  let interactive = answersMouse(options.choice);
  // Where the pointer last was in the page, which a leave is said at.
  let lastPointer = { x: 0, y: 0 };
  let { performance, tuning, cameraControl } = options;
  // A look the listener has tuned is drawn in the band they tuned it in,
  // whatever band the monitor was set with.
  if (tuning?.wave) {
    wave = tuning.wave;
  }

  // The time of day this monitor's page was last told (`monitorDaylight`):
  // the graph's while it follows the graph, else its own, and none where it
  // has no choice of its own.
  const shownDaylight = () =>
    monitorDaylight(
      { followsGraph, daylight: ownDaylight },
      { graph: options.daylight(), brightness: options.brightness() },
    );
  let toldDaylight = shownDaylight();
  let toldLocale = options.locale();

  const surfaceState = (): IWallpaperSurfaceState => {
    toldDaylight = shownDaylight();
    toldLocale = options.locale();
    return {
      phase,
      renderGeneration,
      wave,
      motion,
      performance,
      ...(tuning ? { tuning } : {}),
      ...(toldDaylight !== undefined ? { daylight: toldDaylight } : {}),
      interactive,
      cameraMove: cameraControl.move,
      locale: toldLocale,
    };
  };

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

  // Playing and on the desktop: the only time the page may be handed the
  // mouse. The helper adds its own condition, some of the desktop in sight,
  // which it knows before main does.
  let mouseWanted = false;
  const applyTouch = () => host?.setTouch(interactive && mouseWanted);

  /**
   * One record of the mouse from the helper, handed to the page. Once the
   * mouse is off, only a leave still gets through — the helper's own word
   * that the page should forget the pointer and any press it held.
   */
  const relayPointer = (pointer: TWallpaperPointer) => {
    if (released || window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }
    if (pointer.kind !== 'leave' && !(interactive && mouseWanted)) {
      return;
    }
    const delivery = pointerDelivery(pointer, options.scale, lastPointer);
    if (!delivery) {
      return;
    }
    if ('wheel' in delivery) {
      window.webContents.send(WALLPAPER.wheel, delivery.wheel);
      return;
    }
    const { input } = delivery;
    if (input.type !== 'mouseLeave') {
      lastPointer = { x: input.x, y: input.y };
    }
    window.webContents.sendInputEvent(input);
  };

  const applyPolicy = () => {
    // The helper reports whether any of this monitor's desktop is in sight
    // right after placing the window; showing before that report could
    // flash over a game.
    if (released || !host || !attached || !coverKnown) {
      return;
    }
    const reason = options.pauseReason(cover);
    if (reason) {
      phase = 'paused';
    } else {
      phase = frameReady ? 'running' : 'starting';
    }
    pauseReason = reason;
    // A pause stops the drawing and leaves the picture where it is, with one
    // exception: saving power on battery is a choice made with the desktop in
    // front of the listener, and their own wallpaper coming back is how they
    // see it took. Every other pause keeps the picture. Hiding on a covered
    // monitor was the only part of a pause anybody could see, and it came
    // early: Windows gives a window being maximized its final rectangle before
    // DWM has finished moving it there, so the background went off a strip of
    // desktop still on screen and the wallpaper flashed through it. A locked
    // or sleeping PC keeps its picture too, so it is already there when the
    // screen comes back.
    const visible = reason !== 'battery' && frameReady;
    host.setVisible(visible);
    mouseWanted = visible && !reason;
    applyTouch();
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
    if (!ready) {
      // The helper has placed this window and said whether the monitor can be
      // seen, and the page has drawn: from here the desktop shows this one,
      // moving or held still on a monitor nothing of which is in sight.
      ready = true;
      options.onReady();
    }
    tellPage();
    options.onChange();
  };

  const drawn = (generation: unknown): boolean => {
    if (released || generation !== renderGeneration || phase === 'paused') {
      return false;
    }
    frameReady = true;
    if (host) {
      applyPolicy();
      return true;
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
            coverKnown = true;
            cover = COVERS[message];
          }
          applyPolicy();
        },
        relayPointer,
      );
    } catch (error) {
      log.warn(`Desktop visualizer attachment: ${error}`);
      fail('host');
    }
    // The scene drew either way; the window it is in could not be attached.
    return true;
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
    bounds,
    get lookId() {
      return lookId;
    },
    get scene() {
      return scene;
    },
    phase: () => phase,
    pauseReason: () => pauseReason,
    choice: () => ({
      lookId,
      wave,
      motion,
      ...(followsGraph ? { followsGraph } : {}),
      ...(ownDaylight ? { daylight: ownDaylight } : {}),
      ...(interactive ? {} : { interactive: false }),
    }),
    retunePerformance: (next) => {
      // The whole choice, not the rate and the size alone: the page reads the
      // scaler, the smoothing and the floor on the frames it draws, so a
      // listener who only swaps FSR for the plain stretch sees it here too.
      if (sameScenePerformance(next, performance)) {
        return;
      }
      performance = next;
      tellPage();
    },
    retuneCameraControl: (next) => {
      if (sameSceneCameraControl(next, cameraControl)) {
        return;
      }
      cameraControl = next;
      tellPage();
    },
    applyTuning: (next) => {
      const nextWave = next?.wave ?? wave;
      if (
        sameTuning(next, tuning) &&
        nextWave.height === wave.height &&
        nextWave.position === wave.position
      ) {
        return;
      }
      tuning = next;
      wave = nextWave;
      tellPage();
    },
    applyDaylight: () => {
      if (shownDaylight() !== toldDaylight) {
        tellPage();
      }
    },
    applyLocale: () => {
      if (options.locale() !== toldLocale) {
        tellPage();
      }
    },
    retune: (next) => {
      followsGraph = next.followsGraph === true;
      ownDaylight = next.daylight;
      const nextInteractive = answersMouse(next);
      if (
        next.wave.height === wave.height &&
        next.wave.position === wave.position &&
        next.motion === motion &&
        shownDaylight() === toldDaylight &&
        nextInteractive === interactive
      ) {
        return;
      }
      ({ wave, motion } = next);
      interactive = nextInteractive;
      applyTouch();
      tellPage();
    },
    changeScene: (nextChoice, nextScene, nextTuning) => {
      if (released) {
        return;
      }
      ({ lookId, wave, motion } = nextChoice);
      followsGraph = nextChoice.followsGraph === true;
      ownDaylight = nextChoice.daylight;
      interactive = answersMouse(nextChoice);
      applyTouch();
      scene = nextScene;
      tuning = nextTuning;
      if (tuning?.wave) {
        wave = tuning.wave;
      }
      // The phase stays: the window is on the desktop showing the scene it
      // had until the page has the new one drawn, so nothing is starting.
      renderGeneration += 1;
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
