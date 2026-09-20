import type { TSceneFailure } from '../main/scenePackStore';
import type { IScenePack } from './scenePacks';
import type { IScenePerformance } from './scenePerformance';
import { isPremiumLookId, packIdOfLook } from './scenePacks';
import { parseMemberLookId } from './memberScenes';

export const WALLPAPER = {
  state: 'wallpaper-state',
  changed: 'wallpaper-changed',
  start: 'wallpaper-start',
  stop: 'wallpaper-stop',
  bootstrap: 'wallpaper-bootstrap',
  surfaceChanged: 'wallpaper-surface-changed',
  drawn: 'wallpaper-drawn',
  failed: 'wallpaper-failed',
  requestAudio: 'wallpaper-request-audio',
  readAudio: 'wallpaper-read-audio',
  audio: 'wallpaper-audio',
  audioReady: 'wallpaper-audio-ready',
  /** The window's frame rate and resolution choice, for every monitor. */
  performance: 'wallpaper-performance',
  /** What the listener set for each visualizer: its controls and its timing. */
  tuning: 'wallpaper-tuning',
} as const;

/** More monitors than a desk has; bounds what one request can create. */
export const MAX_WALLPAPER_DISPLAYS = 16;

/**
 * The graph's wave height and position, as a desktop background draws the
 * band its visualizer's spectrum lives in — the same two numbers the graph's
 * View menu sets, taken when the background is set.
 */
export interface IWallpaperWave {
  /** How tall the band is: 0.05 to 1. */
  height: number;
  /** Where its floor stands: 0 the bottom edge, 1 the middle. */
  position: number;
}

/** The whole band, standing on the bottom: what a background had before. */
export const DEFAULT_WALLPAPER_WAVE: IWallpaperWave = {
  height: 1,
  position: 0,
};

/**
 * How a background moves: with whatever is playing, or calmly on its own —
 * a quiet animation that never hears the music.
 */
export type TWallpaperMotion = 'music' | 'calm';

export const WALLPAPER_MOTIONS: readonly TWallpaperMotion[] = ['music', 'calm'];

/** What one monitor is set to show, and how it draws it. */
export interface IWallpaperChoice {
  lookId: string;
  wave: IWallpaperWave;
  motion: TWallpaperMotion;
}

/** Puts one visualizer on every monitor named, replacing what each showed. */
export interface IWallpaperStart extends IWallpaperChoice {
  displayIds: number[];
  pauseOnBattery: boolean;
}

/**
 * `refused`: the scene's own code failed on this computer's graphics while it
 * was drawing here. Nothing is written down, so setting the background again —
 * or the next launch — tries it again; what it does not do is start itself
 * again unasked, which on a scene that resets the driver is a reset a minute.
 */
export type TWallpaperError =
  | 'unsupported'
  | 'unavailable'
  | 'not-entitled'
  | 'missing-scene'
  | 'refused'
  | 'missing-display'
  | 'host'
  | 'renderer'
  | 'audio';

/**
 * Why a monitor is not drawing. `covered` means no part of that
 * monitor's desktop can be seen: windows over every piece of its work
 * area, not merely an app in front of the background.
 */
export type TWallpaperPause =
  'locked' | 'suspended' | 'battery' | 'game' | 'covered';

/** A monitor as Windows' display settings describe it, in physical pixels. */
export interface IWallpaperDisplay {
  id: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export type TWallpaperPhase = 'starting' | 'running' | 'paused' | 'error';

/** What one monitor's background is doing. */
export interface IWallpaperScreen extends IWallpaperChoice {
  displayId: number;
  phase: TWallpaperPhase;
  pauseReason?: TWallpaperPause;
  error?: TWallpaperError;
}

export interface IWallpaperState {
  supported: boolean;
  displays: IWallpaperDisplay[];
  /** Every monitor with a background set, including one that failed. */
  screens: IWallpaperScreen[];
  pauseOnBattery: boolean;
}

/**
 * All a desktop surface is told: whether to draw, which drawing is current,
 * where its band goes, and whether it follows the music.
 */
/**
 * What the listener set for one visualizer, over what its maker built in: the
 * values of its own controls and how quickly it rises and falls
 * (`sceneParamStore.ts`, `sceneResponseStore.ts`). Kept on the graph by look
 * id; a background shows the same visualizer, so it is drawn the same way.
 *
 * Only the two timings the graph's menu offers: what a scene hears at all is
 * its author's to set in the Studio. The scene's own tuner clamps every value
 * it is given, and a control the scene does not have is ignored.
 */
export interface IWallpaperTuning {
  params?: Record<string, number>;
  response?: { attack?: number; release?: number };
  /**
   * The band this visualizer is drawn in where the listener watches it: their
   * own if they moved it, else the one its author built it around, else the
   * graph's. A monitor showing this look takes it as the window has it.
   */
  wave?: IWallpaperWave;
}

export interface IWallpaperSurfaceState {
  phase: Exclude<TWallpaperPhase, 'error'>;
  renderGeneration: number;
  wave: IWallpaperWave;
  motion: TWallpaperMotion;
  /**
   * How hard the scene may drive the GPU (`scenePerformance.ts`): the
   * window's choice, kept by main, since this page has no store of its own.
   */
  performance: IScenePerformance;
  /** What the listener set for this visualizer, when they set anything. */
  tuning?: IWallpaperTuning;
}

/** Scene source is loaded and authorized by main, never sent back by a page. */
export interface IWallpaperBootstrap {
  pack: IScenePack;
  member: boolean;
  state: IWallpaperSurfaceState;
}

export interface IWallpaperAudio {
  points: { x: number; y: number }[];
  waveform: number[];
}

export interface IWallpaperSurfaceBridge {
  bootstrap(): Promise<IWallpaperBootstrap | undefined>;
  drawn(renderGeneration: number): void;
  /**
   * The page cannot draw. With a reason, the scene itself failed — the same
   * reasons the graph reports a look by — and main keeps its code from running
   * again; without one, the page or the machine did.
   */
  failed(reason?: TSceneFailure): void;
  requestAudio(): Promise<IWallpaperAudio | undefined>;
  onState(listener: (state: IWallpaperSurfaceState) => void): () => void;
}

const WALLPAPER_PHASES: readonly TWallpaperPhase[] = [
  'starting',
  'running',
  'paused',
  'error',
];

const WALLPAPER_ERRORS: readonly TWallpaperError[] = [
  'unsupported',
  'unavailable',
  'not-entitled',
  'missing-scene',
  'refused',
  'missing-display',
  'host',
  'renderer',
  'audio',
];

const WALLPAPER_PAUSES: readonly TWallpaperPause[] = [
  'locked',
  'suspended',
  'battery',
  'game',
  'covered',
];

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null;

const isDisplayId = (raw: unknown): raw is number =>
  typeof raw === 'number' && Number.isSafeInteger(raw);

const isDisplayIdList = (raw: unknown): raw is number[] =>
  Array.isArray(raw) &&
  raw.length > 0 &&
  raw.length <= MAX_WALLPAPER_DISPLAYS &&
  raw.every(isDisplayId) &&
  new Set(raw).size === raw.length;

export const isWallpaperLookId = (raw: unknown): raw is string =>
  typeof raw === 'string' &&
  ((isPremiumLookId(raw) && /^[a-z][a-z0-9-]{1,47}$/.test(packIdOfLook(raw))) ||
    parseMemberLookId(raw) !== undefined);

const isUnitNumber = (raw: unknown): raw is number =>
  typeof raw === 'number' && raw >= 0 && raw <= 1;

export const isWallpaperWave = (raw: unknown): raw is IWallpaperWave =>
  isRecord(raw) && isUnitNumber(raw.height) && isUnitNumber(raw.position);

export const isWallpaperMotion = (raw: unknown): raw is TWallpaperMotion =>
  WALLPAPER_MOTIONS.some((motion) => motion === raw);

const isWallpaperChoice = (
  raw: Record<string, unknown>,
): raw is Record<string, unknown> & IWallpaperChoice =>
  isWallpaperLookId(raw.lookId) &&
  isWallpaperWave(raw.wave) &&
  isWallpaperMotion(raw.motion);

export const isWallpaperStart = (raw: unknown): raw is IWallpaperStart =>
  isRecord(raw) &&
  isWallpaperChoice(raw) &&
  isDisplayIdList(raw.displayIds) &&
  typeof raw.pauseOnBattery === 'boolean';

/** No ids at all stops every monitor. */
export const isWallpaperStop = (raw: unknown): raw is number[] | undefined =>
  raw === undefined || isDisplayIdList(raw);

export const isWallpaperAudio = (raw: unknown): raw is IWallpaperAudio => {
  if (!isRecord(raw)) {
    return false;
  }
  const { points, waveform } = raw;
  return (
    Array.isArray(points) &&
    points.length <= 512 &&
    points.every(
      (point) =>
        isRecord(point) && Number.isFinite(point.x) && Number.isFinite(point.y),
    ) &&
    Array.isArray(waveform) &&
    waveform.length <= 2048 &&
    waveform.every(Number.isFinite)
  );
};

/** More controls than any scene declares, and more looks than a desk shows. */
const MAX_TUNED_PARAMS = 64;
const MAX_TUNED_LOOKS = 256;

const isTunedParams = (raw: unknown): raw is Record<string, number> =>
  isRecord(raw) &&
  Object.keys(raw).length <= MAX_TUNED_PARAMS &&
  Object.entries(raw).every(
    ([id, value]) =>
      id.length > 0 &&
      id.length <= 64 &&
      typeof value === 'number' &&
      Number.isFinite(value),
  );

const isTunedTiming = (raw: unknown): raw is IWallpaperTuning['response'] =>
  isRecord(raw) &&
  Object.keys(raw).every((key) => key === 'attack' || key === 'release') &&
  [raw.attack, raw.release].every(
    (value) =>
      value === undefined ||
      (typeof value === 'number' && Number.isFinite(value)),
  );

const isWallpaperTuning = (raw: unknown): raw is IWallpaperTuning =>
  isRecord(raw) &&
  (raw.params === undefined || isTunedParams(raw.params)) &&
  (raw.response === undefined || isTunedTiming(raw.response)) &&
  (raw.wave === undefined || isWallpaperWave(raw.wave));

/**
 * What the window says the listener set, by look id. Bounded and checked like
 * every other request: a page draws by these numbers.
 */
export const isWallpaperTuningMap = (
  raw: unknown,
): raw is Record<string, IWallpaperTuning> =>
  isRecord(raw) &&
  Object.keys(raw).length <= MAX_TUNED_LOOKS &&
  Object.entries(raw).every(
    ([lookId, tuning]) =>
      isWallpaperLookId(lookId) && isWallpaperTuning(tuning),
  );

const isWallpaperDisplay = (raw: unknown): raw is IWallpaperDisplay =>
  isRecord(raw) &&
  isDisplayId(raw.id) &&
  typeof raw.label === 'string' &&
  [raw.x, raw.y, raw.width, raw.height].every(Number.isFinite) &&
  typeof raw.primary === 'boolean';

const isWallpaperScreen = (raw: unknown): raw is IWallpaperScreen =>
  isRecord(raw) &&
  isDisplayId(raw.displayId) &&
  isWallpaperChoice(raw) &&
  WALLPAPER_PHASES.some((phase) => phase === raw.phase) &&
  (raw.pauseReason === undefined ||
    WALLPAPER_PAUSES.some((pause) => pause === raw.pauseReason)) &&
  (raw.error === undefined ||
    WALLPAPER_ERRORS.some((error) => error === raw.error));

/**
 * The window checks what main sends. A main process started before a change
 * to this shape stays running while the window reloads beside it, and an
 * unchecked `screens` read there took the whole window down.
 */
export const isWallpaperState = (raw: unknown): raw is IWallpaperState =>
  isRecord(raw) &&
  typeof raw.supported === 'boolean' &&
  Array.isArray(raw.displays) &&
  raw.displays.every(isWallpaperDisplay) &&
  Array.isArray(raw.screens) &&
  raw.screens.every(isWallpaperScreen) &&
  typeof raw.pauseOnBattery === 'boolean';

export const wallpaperPauseReason = (conditions: {
  locked: boolean;
  suspended: boolean;
  battery: boolean;
  /** A game is in front: every screen holds still, covered or not. */
  game: boolean;
  covered: boolean;
  pauseOnBattery: boolean;
}): TWallpaperPause | undefined => {
  if (conditions.locked) {
    return 'locked';
  }
  if (conditions.suspended) {
    return 'suspended';
  }
  if (conditions.battery && conditions.pauseOnBattery) {
    return 'battery';
  }
  // Before `covered`, and not per screen: a game takes the whole machine's
  // frames, and a monitor the game does not cover is still drawing on the
  // same graphics card it is playing on.
  if (conditions.game) {
    return 'game';
  }
  if (conditions.covered) {
    return 'covered';
  }
  return undefined;
};
