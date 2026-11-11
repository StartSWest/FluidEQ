import type { ISceneFailureEntry } from './sceneFailureLog';
import type { TSceneFailure } from '../main/scenePackStore';
import type { IScenePack } from './scenePacks';
import type { TSceneCameraMotion } from './sceneCameraControl';
import type { IScenePerformance } from './scenePerformance';
import type { TSceneMaker } from './sceneMaker';
import { isPremiumLookId, packIdOfLook } from './scenePacks';
import { parseMemberLookId } from './memberScenes';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from './sceneDaylight';

export const WALLPAPER = {
  state: 'wallpaper-state',
  changed: 'wallpaper-changed',
  start: 'wallpaper-start',
  stop: 'wallpaper-stop',
  bootstrap: 'wallpaper-bootstrap',
  surfaceChanged: 'wallpaper-surface-changed',
  drawn: 'wallpaper-drawn',
  failed: 'wallpaper-failed',
  sceneFailure: 'wallpaper-scene-failure',
  requestAudio: 'wallpaper-request-audio',
  readAudio: 'wallpaper-read-audio',
  audio: 'wallpaper-audio',
  audioReady: 'wallpaper-audio-ready',
  /** The window's frame rate and resolution choice, for every monitor. */
  performance: 'wallpaper-performance',
  /**
   * How a scene's camera is moved (`sceneCameraControl.ts`): the key the
   * desktop helper reads for it, and the way its pages turn.
   */
  cameraControl: 'wallpaper-camera-control',
  /** What the listener set for each visualizer: its controls and its timing. */
  tuning: 'wallpaper-tuning',
  /**
   * The Plus visualizer the graph is showing, for the monitors set to follow
   * it. Only ever a Plus one: the graph on a free look says nothing, and a
   * monitor following it keeps the last Plus one it was given.
   */
  graphLook: 'wallpaper-graph-look',
  /**
   * The time of day the window asks of its scenes (`sceneDaylight.ts`,
   * `TWallpaperDaylight`), for the monitors set to follow the graph: their
   * scene turns from night to day with the window's (Ivan, 2026-09-28:
   * "desktop needs to follow that too ... only if follow graph is enabled").
   */
  graphDaylight: 'wallpaper-graph-daylight',
  /**
   * The window's Brightness as a time of day (`daylightOfShade`), for the
   * monitors set to follow Brightness on their own (`IWallpaperDaylight`),
   * whatever the graph's own time of day follows.
   */
  brightnessDaylight: 'wallpaper-brightness-daylight',
  /**
   * The mouse wheel over a monitor's bare desktop, for its page
   * (`IWallpaperWheel`). The rest of the mouse reaches the page as real
   * input (`pointerRelay.ts`); a wheel sent that way to a window that cannot
   * take focus never arrives.
   */
  wheel: 'wallpaper-wheel',
} as const;

/**
 * The word for "the clock's time of day" in place of a number
 * (`TWallpaperDaylight`).
 */
export const WALLPAPER_CLOCK_DAYLIGHT = 'clock';

/**
 * The time of day the window gives a monitor following the graph: 0 night to
 * 100 day, from its Brightness or set by the listener, or the clock itself
 * (Ivan, 2026-09-29: "follows the daytime"). The clock is sent as a word and
 * read on the monitor, frame by frame (`clockDaylight`), rather than as a
 * number the window keeps sending: the window stops drawing while it is
 * minimised, and a desktop is exactly what plays then.
 */
export type TWallpaperDaylight = number | typeof WALLPAPER_CLOCK_DAYLIGHT;

/**
 * Where a monitor that does not follow the graph takes its time of day from,
 * the same three the graph offers (`sceneDaylightSetting.ts`): a Daylight set
 * by hand, the window's Brightness, or the computer's clock (Ivan,
 * 2026-11-08: "when they are not following grahp we choose the time of day
 * for the walpaper including use off (configurable manully), app or time").
 */
export type TWallpaperDaylightSource = 'own' | 'brightness' | 'clock';

export const WALLPAPER_DAYLIGHT_SOURCES: readonly TWallpaperDaylightSource[] = [
  'own',
  'brightness',
  'clock',
];

export interface IWallpaperDaylight {
  source: TWallpaperDaylightSource;
  /** 0 night to 100 day, whole: what it plays at on its `own`. */
  daylight: number;
}

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
  /**
   * Shows whichever Plus visualizer the graph shows, and changes when the
   * graph does — picked by hand or by its automatic switching. The graph on a
   * free look leaves the monitor on the last Plus one: following never takes
   * a background off the desktop. Absent is false.
   */
  followsGraph?: boolean;
  /**
   * The monitor's own time of day, used while it does not follow the graph;
   * one that follows takes the graph's. Kept across another visualizer on
   * the same monitor: it is the monitor's, not the look's. Absent, the scene
   * plays at the hour its author made it at.
   */
  daylight?: IWallpaperDaylight;
  /**
   * The scene answers the mouse over the monitor's bare desktop as it does on
   * the graph — the hand, a tap, Ctrl and a drag or the wheel to turn and zoom
   * its camera (Ivan, 2026-11-09: "I want to eanble desltop walpaper to be
   * interactive as the viz un the app"). Absent is on: it is how a scene is
   * played everywhere else, and it reads no key but Ctrl at a press, nothing
   * while the background is paused or hidden, and nothing over an icon, a
   * window or the taskbar. Kept, like the time of day, across another
   * visualizer on the same monitor; only `false` is ever written.
   */
  interactive?: boolean;
}

/** Whether a monitor's scene answers the mouse (`interactive`, absent is on). */
export const answersMouse = (choice: Pick<IWallpaperChoice, 'interactive'>) =>
  choice.interactive !== false;

/**
 * Puts one visualizer on every monitor named, replacing what each showed.
 * `followsGraph` left out keeps a monitor already set to this look following
 * as it was, and stops it on a monitor given a different look by name.
 */
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
 * area, not merely an app in front of the background. `window` is that
 * cover resting on FluidEQ's own window, so minimising it brings the
 * desktop back (`TWallpaperCover`).
 */
export type TWallpaperPause =
  'locked' | 'suspended' | 'battery' | 'game' | 'covered' | 'window';

/**
 * What keeps a monitor's desktop out of sight, as its helper reports it:
 * nothing; FluidEQ's own window, without which some of it would show; or
 * other windows, which hide it with or without FluidEQ's.
 */
export type TWallpaperCover = 'none' | 'window' | 'others';

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
  /**
   * The time of day this monitor plays at (`monitorDaylight`): the window's
   * while it follows the graph, else the monitor's own. Absent where it has
   * no choice of its own: its scene keeps the time of day its author gave it.
   */
  daylight?: TWallpaperDaylight;
  /**
   * The mouse reaches this page (`IWallpaperChoice.interactive`): the hand is
   * on its scene, with the view's reset beside it. Off, the camera goes back
   * to the author's view, where nothing could turn it back otherwise.
   */
  interactive: boolean;
  /**
   * How the window moves a scene's camera (`ISceneCameraControl`): the
   * camera's key and a drag, or the key and the mouse moving alone; whether
   * a scene leans towards the pointer; whether one that turns all the way
   * round circles by itself. The key itself is not here: the helper reads
   * whichever the window chose and main hands it on as Ctrl.
   */
  camera: TSceneCameraMotion;
  /** The window's language, which the page's few words are in. */
  locale: string;
}

/**
 * The wheel over a monitor's bare desktop: where, in the page's own pixels,
 * how far (100 a notch, positive towards the hand, as a page's `deltaY`), and
 * whether Ctrl was down — the camera's zoom, as on the graph.
 */
export interface IWallpaperWheel {
  x: number;
  y: number;
  deltaY: number;
  ctrlKey: boolean;
}

/** Scene source is loaded and authorized by main, never sent back by a page. */
export interface IWallpaperBootstrap {
  pack: IScenePack;
  /**
   * Who made the scene, in main's word: the listener's own is run as
   * their own on the desktop, as it is everywhere else (`sceneRules.ts`).
   */
  madeBy: TSceneMaker;
  state: IWallpaperSurfaceState;
}

export interface IWallpaperAudio {
  points: { x: number; y: number }[];
  waveform: number[];
  /**
   * Where the music leans, -1 left to 1 right, and how wide it is, 0..1
   * (`stereoImage.ts`), as the graph's own scenes hear it. Absent where
   * the capture is not in stereo.
   */
  stereo?: readonly [number, number];
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
  /** One line in the app log for a way the scene did not play. */
  logSceneFailure(entry: ISceneFailureEntry): void;
  requestAudio(): Promise<IWallpaperAudio | undefined>;
  onState(listener: (state: IWallpaperSurfaceState) => void): () => void;
  /** The wheel over this monitor's bare desktop, while the mouse is on. */
  onWheel(listener: (wheel: IWallpaperWheel) => void): () => void;
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
  'window',
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

/** A time of day as the window gives it (`TWallpaperDaylight`). */
export const isWallpaperDaylight = (raw: unknown): raw is TWallpaperDaylight =>
  raw === WALLPAPER_CLOCK_DAYLIGHT ||
  (typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= SCENE_DAYLIGHT_MIN &&
    raw <= SCENE_DAYLIGHT_MAX);

/** A monitor's own time of day as the window sets it (`IWallpaperDaylight`). */
export const isWallpaperDaylightChoice = (
  raw: unknown,
): raw is IWallpaperDaylight =>
  isRecord(raw) &&
  WALLPAPER_DAYLIGHT_SOURCES.some((source) => source === raw.source) &&
  typeof raw.daylight === 'number' &&
  isWallpaperDaylight(raw.daylight);

/**
 * What a monitor's page is told to play its time of day at: the graph's while
 * it follows the graph, else its own choice — the clock as the word the page
 * reads frame by frame, Brightness as the window last said it (or the
 * monitor's own Daylight until the window has said anything) — and nothing
 * where no choice was made, so the scene keeps its author's hour.
 */
export const monitorDaylight = (
  choice: Pick<IWallpaperChoice, 'followsGraph' | 'daylight'>,
  told: {
    graph: TWallpaperDaylight | undefined;
    brightness: number | undefined;
  },
): TWallpaperDaylight | undefined => {
  if (choice.followsGraph === true) {
    return told.graph;
  }
  const own = choice.daylight;
  if (!own) {
    return undefined;
  }
  if (own.source === 'clock') {
    return WALLPAPER_CLOCK_DAYLIGHT;
  }
  return own.source === 'brightness'
    ? (told.brightness ?? own.daylight)
    : own.daylight;
};

/** Two monitors' own times of day are the same choice. */
export const sameWallpaperDaylight = (
  a: IWallpaperDaylight | undefined,
  b: IWallpaperDaylight | undefined,
): boolean => a?.source === b?.source && a?.daylight === b?.daylight;

const isWallpaperChoice = (
  raw: Record<string, unknown>,
): raw is Record<string, unknown> & IWallpaperChoice =>
  isWallpaperLookId(raw.lookId) &&
  isWallpaperWave(raw.wave) &&
  isWallpaperMotion(raw.motion) &&
  (raw.followsGraph === undefined || typeof raw.followsGraph === 'boolean') &&
  (raw.daylight === undefined || isWallpaperDaylightChoice(raw.daylight)) &&
  (raw.interactive === undefined || typeof raw.interactive === 'boolean');

export const isWallpaperStart = (raw: unknown): raw is IWallpaperStart =>
  isRecord(raw) &&
  isWallpaperChoice(raw) &&
  isDisplayIdList(raw.displayIds) &&
  typeof raw.pauseOnBattery === 'boolean';

/** No ids at all stops every monitor. */
export const isWallpaperStop = (raw: unknown): raw is number[] | undefined =>
  raw === undefined || isDisplayIdList(raw);

/** A balance of -1..1 and a width of 0..1, as `stereoImage.ts` reads them. */
const isStereoImage = (raw: unknown): raw is readonly [number, number] => {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return false;
  }
  const [balance, width]: unknown[] = raw;
  return (
    typeof balance === 'number' &&
    typeof width === 'number' &&
    Math.abs(balance) <= 1 &&
    width >= 0 &&
    width <= 1
  );
};

export const isWallpaperAudio = (raw: unknown): raw is IWallpaperAudio => {
  if (!isRecord(raw)) {
    return false;
  }
  const { points, waveform, stereo } = raw;
  return (
    Array.isArray(points) &&
    points.length <= 512 &&
    points.every(
      (point) =>
        isRecord(point) && Number.isFinite(point.x) && Number.isFinite(point.y),
    ) &&
    Array.isArray(waveform) &&
    waveform.length <= 2048 &&
    waveform.every(Number.isFinite) &&
    (stereo === undefined || isStereoImage(stereo))
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
  cover: TWallpaperCover;
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
  if (conditions.cover === 'window') {
    return 'window';
  }
  if (conditions.cover === 'others') {
    return 'covered';
  }
  return undefined;
};
