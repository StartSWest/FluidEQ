/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import {
  WALLPAPER_CLOCK_DAYLIGHT,
  type IWallpaperSurfaceState,
  type TWallpaperCover,
  type TWallpaperPause,
} from '../../common/wallpaper';
import type { IDesktopHost } from './desktopHost';
import type { IMonitorDrawChoice, IMonitorRect } from './desktopHostWire';
import {
  desktopHostSceneOf,
  measuredByFluidEq,
  monitorDrawChoiceOf,
} from './desktopScene';
import {
  startWallpaperHost,
  type IWallpaperHost,
  type TWallpaperHostEvent,
} from './nativeHost';
import type { IDesktopSurface, IDesktopSurfaceOptions } from './surface';

/** The cover each of the helper's reports describes (`surface.ts`). */
const COVERS: Record<
  Exclude<TWallpaperHostEvent, 'ready' | 'error'>,
  TWallpaperCover
> = {
  active: 'none',
  paused: 'others',
  'paused-owner': 'window',
};

export interface INativeDesktopSurfaceOptions extends IDesktopSurfaceOptions {
  /** The monitor's rectangle in physical pixels, for the host's window. */
  rect: IMonitorRect;
  host: IDesktopHost;
  /** Whether the computer runs on its battery: every refresh is then sixty. */
  onBattery(): boolean;
}

/**
 * One monitor's background drawn by C++ (`desktopHost.ts`) rather than by a
 * hidden page: the same surface to the backgrounds (`surface.ts`), the same
 * desktop helper placing the window behind the icons and saying when the
 * monitor is covered, and the same rules — placed once the scene has a
 * frame, shown only then, a pause holding the picture and drawing nothing.
 * What the page drew from (`WallpaperSceneLayer.tsx`), main works out here
 * (`desktopScene.ts`). Only for a background the host draws as the page
 * would (`drawnByDesktopHost`): the backgrounds keep the page for the rest.
 */
export const createNativeDesktopSurface = (
  options: INativeDesktopSurfaceOptions,
): IDesktopSurface => {
  const { displayId, bounds, executable, rect } = options;
  let { scene } = options;
  let { lookId, wave, motion } = options.choice;
  let followsGraph = options.choice.followsGraph === true;
  let { performance, tuning } = options;
  if (tuning?.wave) {
    wave = tuning.wave;
  }
  let helper: IWallpaperHost | undefined;
  let hwnd: bigint | undefined;
  let released = false;
  let attached = false;
  let coverKnown = false;
  let cover: TWallpaperCover = 'none';
  let ready = false;
  let frameReady = false;
  let renderGeneration = 1;
  let phase: IWallpaperSurfaceState['phase'] = 'starting';
  let pauseReason: TWallpaperPause | undefined;
  let drawingPaused = false;

  const drawChoice = (): IMonitorDrawChoice =>
    monitorDrawChoiceOf(performance, options.onBattery());
  let toldChoice = JSON.stringify(drawChoice());
  /** The choice told again, when the performance or the battery moved it. */
  const retell = () => {
    const next = drawChoice();
    const text = JSON.stringify(next);
    if (text !== toldChoice) {
      toldChoice = text;
      monitor.choose(next);
    }
  };

  const shownDaylight = () => (followsGraph ? options.daylight() : undefined);
  let toldDaylight = shownDaylight();

  const surfaceState = (): IWallpaperSurfaceState => ({
    phase,
    renderGeneration,
    wave,
    motion,
    performance,
    ...(tuning ? { tuning } : {}),
    ...(toldDaylight !== undefined ? { daylight: toldDaylight } : {}),
  });

  // Declared before the monitor opens: its answers can only come later, on
  // the event loop, but their handlers read this binding.
  let fail: (
    error: Parameters<IDesktopSurfaceOptions['onFail']>[0],
  ) => void = () => undefined;

  const applyPolicy = () => {
    // The helper says whether any of this monitor's desktop is in sight right
    // after placing the window; showing before that could flash over a game.
    if (released) {
      return;
    }
    // Unplugged or plugged in: every refresh the monitor offers, or sixty.
    retell();
    if (!helper || !attached || !coverKnown) {
      return;
    }
    const reason = options.pauseReason(cover);
    if (reason) {
      phase = 'paused';
    } else {
      phase = frameReady ? 'running' : 'starting';
    }
    pauseReason = reason;
    // Paused, the host draws nothing and the picture stays; only saving
    // power on battery takes it off (`surface.ts` says why).
    const paused = reason !== undefined;
    if (paused !== drawingPaused) {
      drawingPaused = paused;
      monitor.pause(paused);
    }
    helper.setVisible(reason !== 'battery' && frameReady);
    if (!ready) {
      ready = true;
      options.onReady();
    }
    options.onChange();
  };

  const place = () => {
    if (helper || hwnd === undefined) {
      return;
    }
    const handle = Buffer.alloc(8);
    handle.writeBigUInt64LE(hwnd);
    try {
      helper = startWallpaperHost(
        executable,
        handle,
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
        monitor.pid(),
      );
    } catch (error) {
      log.warn(`Desktop visualizer attachment: ${error}`);
      fail('host');
    }
  };

  const daylightOf = () => {
    toldDaylight = shownDaylight();
    return toldDaylight === undefined ||
      toldDaylight === WALLPAPER_CLOCK_DAYLIGHT
      ? ({ clock: true } as const)
      : ({ clock: false, value: toldDaylight } as const);
  };

  const monitor = options.host.open(rect, drawChoice(), {
    window: (window) => {
      hwnd = window;
    },
    loaded: () => undefined,
    drawn: (id) => {
      if (released || id !== renderGeneration) {
        return;
      }
      frameReady = true;
      // Placed only once the scene has a frame, so the desktop never shows
      // an empty window while the shader links.
      if (helper) {
        applyPolicy();
      } else {
        place();
      }
    },
    failed: (id, reason, words) => {
      if (id !== 0 && id !== renderGeneration) {
        return;
      }
      log.warn(`Desktop visualizer (C++): ${reason} ${words}`);
      fail('renderer');
    },
  });

  const show = () =>
    monitor.show(
      renderGeneration,
      desktopHostSceneOf(scene, rect, wave, tuning),
      measuredByFluidEq(scene),
    );

  const release = () => {
    if (released) {
      return;
    }
    released = true;
    helper?.stop();
    monitor.close();
  };

  fail = (error) => {
    if (released) {
      return;
    }
    release();
    options.onFail(error);
  };

  monitor.daylight(daylightOf());
  show();

  /** A change that the scene's program is built from: drawn as a new one. */
  const reshow = () => {
    renderGeneration += 1;
    show();
    options.onChange();
  };

  return {
    displayId,
    drawnBy: 'host',
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
    }),
    retunePerformance: (next) => {
      performance = next;
      retell();
    },
    applyTuning: (next) => {
      const nextWave = next?.wave ?? wave;
      if (
        JSON.stringify(next ?? null) === JSON.stringify(tuning ?? null) &&
        nextWave.height === wave.height &&
        nextWave.position === wave.position
      ) {
        return;
      }
      tuning = next;
      wave = nextWave;
      reshow();
    },
    applyDaylight: () => {
      if (shownDaylight() !== toldDaylight) {
        monitor.daylight(daylightOf());
      }
    },
    retune: (next) => {
      followsGraph = next.followsGraph === true;
      const moved =
        next.wave.height !== wave.height ||
        next.wave.position !== wave.position;
      ({ wave, motion } = next);
      if (shownDaylight() !== toldDaylight) {
        monitor.daylight(daylightOf());
      }
      if (moved) {
        reshow();
      }
    },
    changeScene: (nextChoice, nextScene, nextTuning) => {
      if (released) {
        return;
      }
      ({ lookId, wave, motion } = nextChoice);
      followsGraph = nextChoice.followsGraph === true;
      scene = nextScene;
      tuning = nextTuning;
      if (tuning?.wave) {
        wave = tuning.wave;
      }
      // The scene on the monitor stays until the new one has linked.
      reshow();
    },
    surfaceState,
    owns: () => false,
    applyPolicy,
    // The host says its own first frames; a page's report is never this one's.
    drawn: () => undefined,
    fail: (error) => fail(error),
    release,
  };
};
