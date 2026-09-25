import fs from 'fs';
import path from 'path';
import {
  DEFAULT_SCENE_PERFORMANCE,
  normalizeScenePerformance,
  type IScenePerformance,
} from '../../common/scenePerformance';
import {
  DEFAULT_WALLPAPER_WAVE,
  MAX_WALLPAPER_DISPLAYS,
  isWallpaperLookId,
  isWallpaperMotion,
  isWallpaperTuningMap,
  isWallpaperWave,
  type IWallpaperChoice,
  type IWallpaperDisplay,
  type IWallpaperTuning,
} from '../../common/wallpaper';
import writeFileAtomically from '../atomicWrite';

const FILE_NAME = 'desktop-backgrounds.json';

/** A monitor as it stood when a visualizer was set on it, to find it again. */
export interface ISavedMonitor {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISavedScreen {
  displayId: number;
  choice: IWallpaperChoice;
  monitor: ISavedMonitor;
}

/** What each monitor was last set to show, and the one battery choice. */
export interface IWallpaperArrangement {
  pauseOnBattery: boolean;
  /** The window's frame rate and resolution choice, for every monitor. */
  performance: IScenePerformance;
  /**
   * What the listener set for each visualizer, by look id. Kept here so a
   * background brought back at launch is drawn as they tuned it before the
   * window has read its own store.
   */
  tuning: Record<string, IWallpaperTuning>;
  screens: ISavedScreen[];
}

export interface IArrangementStore {
  read(): IWallpaperArrangement;
  write(arrangement: IWallpaperArrangement): void;
}

const EMPTY: IWallpaperArrangement = {
  pauseOnBattery: true,
  performance: DEFAULT_SCENE_PERFORMANCE,
  tuning: {},
  screens: [],
};

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null;

const isSavedMonitor = (raw: unknown): raw is ISavedMonitor =>
  isRecord(raw) &&
  typeof raw.label === 'string' &&
  raw.label.length <= 256 &&
  [raw.x, raw.y, raw.width, raw.height].every(Number.isSafeInteger) &&
  Number(raw.width) > 0 &&
  Number(raw.height) > 0;

/** One monitor as the file lays it out: flat, its choice beside its monitor. */
interface IStoredScreen {
  displayId: number;
  lookId: string;
  wave?: unknown;
  motion?: unknown;
  followsGraph?: unknown;
  monitor: ISavedMonitor;
}

// Files written before backgrounds kept a wave, or a motion, have none, and
// meant the whole band following the music: what those were drawn with. One
// written before a monitor could follow the graph meant one that did not.
const isStoredScreen = (raw: unknown): raw is IStoredScreen =>
  isRecord(raw) &&
  Number.isSafeInteger(raw.displayId) &&
  isWallpaperLookId(raw.lookId) &&
  (raw.wave === undefined || isWallpaperWave(raw.wave)) &&
  (raw.motion === undefined || isWallpaperMotion(raw.motion)) &&
  (raw.followsGraph === undefined || typeof raw.followsGraph === 'boolean') &&
  isSavedMonitor(raw.monitor);

/** The file is read back as untrusted: anything but what this module writes is ignored whole. */
export const parseArrangement = (
  raw: unknown,
): IWallpaperArrangement | undefined => {
  if (
    !isRecord(raw) ||
    raw.version !== 1 ||
    typeof raw.pauseOnBattery !== 'boolean' ||
    !Array.isArray(raw.screens) ||
    raw.screens.length > MAX_WALLPAPER_DISPLAYS ||
    !raw.screens.every(isStoredScreen)
  ) {
    return undefined;
  }
  const screens = raw.screens.map((entry: IStoredScreen): ISavedScreen => ({
    displayId: entry.displayId,
    choice: {
      lookId: entry.lookId,
      wave: isWallpaperWave(entry.wave)
        ? { height: entry.wave.height, position: entry.wave.position }
        : DEFAULT_WALLPAPER_WAVE,
      motion: isWallpaperMotion(entry.motion) ? entry.motion : 'music',
      ...(entry.followsGraph === true ? { followsGraph: true } : {}),
    },
    monitor: {
      label: entry.monitor.label,
      x: entry.monitor.x,
      y: entry.monitor.y,
      width: entry.monitor.width,
      height: entry.monitor.height,
    },
  }));
  if (
    new Set(screens.map((entry) => entry.displayId)).size !== screens.length
  ) {
    return undefined;
  }
  return {
    pauseOnBattery: raw.pauseOnBattery,
    // Files written before the choice existed have none, and meant what a
    // fresh install means.
    performance: normalizeScenePerformance(raw.performance),
    // A tuning of an unknown shape is nothing tuned, never a reason to drop
    // every monitor's background with it.
    tuning: isWallpaperTuningMap(raw.tuning) ? raw.tuning : {},
    screens,
  };
};

const storedScreenOf = ({
  displayId,
  choice,
  monitor,
}: ISavedScreen): IStoredScreen => ({ displayId, ...choice, monitor });

export const createArrangementStore = (
  userDataDir: string,
  logger: { warn(message: string): void },
): IArrangementStore => {
  const filePath = path.join(userDataDir, FILE_NAME);
  return {
    read: () => {
      let text: string;
      try {
        text = fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        // No file is every launch before the first background is set.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(`Desktop backgrounds could not be read: ${error}`);
        }
        return EMPTY;
      }
      let parsed: IWallpaperArrangement | undefined;
      try {
        parsed = parseArrangement(JSON.parse(text));
      } catch (error) {
        logger.warn(`Desktop backgrounds file is not JSON: ${error}`);
        return EMPTY;
      }
      if (!parsed) {
        logger.warn('Desktop backgrounds file has an unknown shape; ignored.');
        return EMPTY;
      }
      return parsed;
    },
    write: ({ pauseOnBattery, performance, tuning, screens }) =>
      writeFileAtomically(
        filePath,
        `${JSON.stringify(
          {
            version: 1,
            pauseOnBattery,
            performance,
            tuning,
            screens: screens.map(storedScreenOf),
          },
          null,
          2,
        )}\n`,
      ),
  };
};

export const savedMonitorOf = (display: IWallpaperDisplay): ISavedMonitor => ({
  label: display.label,
  x: display.x,
  y: display.y,
  width: display.width,
  height: display.height,
});

export interface IScreenMatch {
  saved: ISavedScreen;
  display: IWallpaperDisplay;
}

/**
 * Which connected monitor each remembered background belongs on.
 *
 * Chromium names a monitor after the output Windows reports it on
 * (`\\.\DISPLAY5`), and a driver update or a cable moved to another port
 * renumbers the outputs. So a monitor is found by its id first; failing that,
 * as the same model at the same resolution, nearest to where it stood; and
 * failing that, as the same resolution in the same place. Two monitors never
 * take the same background, and one that is found nowhere is left missing.
 */
export const matchSavedScreens = (
  saved: readonly ISavedScreen[],
  displays: readonly IWallpaperDisplay[],
): { matches: IScreenMatch[]; missing: ISavedScreen[] } => {
  const free = new Map(displays.map((display) => [display.id, display]));
  const matches: IScreenMatch[] = [];
  const claim = (entry: ISavedScreen, display: IWallpaperDisplay) => {
    free.delete(display.id);
    matches.push({ saved: entry, display });
  };
  const unmatched: ISavedScreen[] = [];
  saved.forEach((entry) => {
    const display = free.get(entry.displayId);
    if (display) {
      claim(entry, display);
    } else {
      unmatched.push(entry);
    }
  });
  const missing: ISavedScreen[] = [];
  unmatched.forEach((entry) => {
    const { monitor } = entry;
    const distance = (display: IWallpaperDisplay) =>
      Math.hypot(display.x - monitor.x, display.y - monitor.y);
    const nearest = [...free.values()]
      .filter(
        (display) =>
          display.width === monitor.width &&
          display.height === monitor.height &&
          ((monitor.label !== '' && display.label === monitor.label) ||
            (display.x === monitor.x && display.y === monitor.y)),
      )
      .sort((a, b) => distance(a) - distance(b))[0];
    if (nearest) {
      claim(entry, nearest);
    } else {
      missing.push(entry);
    }
  });
  return { matches, missing };
};
