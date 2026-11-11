import type { ISceneEditReport } from 'common/sceneEdit';
import type { TSceneMaker } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
import type { IScenePerformance } from 'common/scenePerformance';
import type { IWorldReport } from 'common/worldNotes';
import type { TSceneFailure } from 'main/scenePackStore';
import type { ISceneFrame } from './sceneGl';
import type { ISceneInteraction } from './sceneInteraction';
import type { ISceneTuning } from './sceneTuner';
import type { ISceneShownFrames } from './sceneWorkerMessages';
import type { TSceneView } from './sceneView';

/**
 * What drawing is costing, after every frame: for the Studio's readout and
 * for anything that wants to say how a scene is keeping up.
 */
export interface ISceneDrawReport {
  /** The scale the scene was drawn at, from the ladder or the listener's preset. */
  scale: number;
  /** The GPU's own time for its newest finished frame, where it has a clock. */
  costMs?: number;
  /** The finishing passes' share of it (`scenePost.ts`). */
  postMs?: number;
  /** The interval frames are being drawn at. */
  intervalMs: number;
  /**
   * The frames the worker has put on the canvas so far, on its own clock —
   * what a readout of the frame rate counts, since the page's frames are
   * only how often it hands the music over (`ISceneShownFrames`).
   */
  shown?: ISceneShownFrames;
  /** The pixels the scene was drawn at, and the panel's own. */
  drawnWidth: number;
  drawnHeight: number;
  outputWidth: number;
  outputHeight: number;
  /** How the picture was finished: FSR up to size, FXAA over it. */
  fsr: boolean;
  fxaa: boolean;
  /** The Studio's Edit mode answered, when the frame asked. */
  edit?: ISceneEditReport;
}

/**
 * Where a scene comes from, who made it, and what to do when it cannot run —
 * the only things that differ between the places a scene plays. How it is
 * run follows from who made it, in `sceneRules.ts`, and the runner
 * (`useSceneRunner.ts`) reads it from there for every place alike: a source
 * cannot ask for a ladder, a limiter or a rest of its own, which is how the
 * desktop once drew the listener's own scene ghosted beside a clean Studio.
 */
export interface ISceneSource {
  /** What is being drawn. A change starts the clock and the fade again. */
  identity: string;
  /** Which version of it. A change swaps the program in place. */
  version: string;
  /** For the console, where a person can act on it. */
  name: string;
  load(): Promise<IScenePack | undefined>;
  /** The machine or the bridge failed, not the scene: fall back this session. */
  block(): void;
  /**
   * The scene itself failed here. `log` is the driver's message.
   * `gpu-reset` is a lost context the scene's own frame is blamed for, and
   * outlives the build; `context-lost` is a second loss nothing was blamed
   * for before any frame came back from the first.
   */
  reportFailure(reason: TSceneFailure, log?: string): void;
  /**
   * A newer version would not compile, and an earlier one is drawn in its
   * place — the one already on the canvas, or `lastBuilt`'s. The scene has not
   * failed: nothing falls back, and only a place whose author can act on the
   * driver's message (the Studio) shows it.
   */
  versionFailed?(log: string): void;
  /**
   * The last version of this scene that built here, for a first build that
   * will not compile (`sceneBuilds.ts`). Absent, or nothing kept, and that
   * failure is `reportFailure`'s.
   */
  lastBuilt?(): Promise<IScenePack | undefined>;
  /** The version this source names now has built and is drawn. */
  built?(): void;
  /**
   * It held the GPU so long at its smallest size that it would freeze the
   * window (`sceneWarmup.ts`): a member's scene only. Never called for a
   * scene that is merely slow, which rests at its smallest size.
   */
  tooSlow(): void;
  /**
   * What a 3D world left out, or why it was drawn as its shader instead —
   * for the Studio, where its author can fix it. Elsewhere the scene simply
   * plays as well as this machine can play it.
   */
  reportWorld?(report: IWorldReport): void;
  /**
   * Who made the scene (`sceneMaker.ts`): FluidEQ, the listener, or another
   * member. Its size ladder, its brightness limiter and whether it is
   * compiled ahead follow from this alone (`sceneRules.ts`).
   */
  madeBy: TSceneMaker;
}

export interface ISceneRunnerOptions {
  source: ISceneSource;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
  /**
   * Where the scene's panel stands on the canvas, when the canvas is larger
   * than it: the Backdrop, where the canvas is the window and the graph is
   * still the scene's frame (`sceneView.ts`). Absent is the panel filling it.
   */
  view?: TSceneView;
  /**
   * The element the host stands in, for a place that moves it from one layer
   * to another rather than making another (`SceneCanvas`). Each new one is
   * watched afresh for being seen: what hides a host is its ancestors, and a
   * moved host has new ones.
   */
  placement?: Element;
  /**
   * Changes whenever the host moves inside a frame that does not resize it:
   * the Studio's stage zoomed and panned (`useStageZoom.ts`). Only the part
   * of the host inside the window is drawn, and it is measured again on a
   * resize or a scroll; a move is neither, so the part a pan brought into
   * view stayed undrawn (Ivan, 2026-11-08: "when zooming and panning not
   * redrawing the new discovered zone").
   */
  moved?: string;
  /** Replaces what the scene hears — the Studio's test signals. */
  shapeFrame?: (frame: ISceneFrame) => ISceneFrame;
  /** Read every frame, so moving a slider moves the scene at once. */
  tuning?: ISceneTuning;
  /**
   * The time of day to draw at (`common/sceneDaylight.ts`), read every
   * frame and eased there. Absent, this window's own Brightness decides; the
   * desktop's page has none worth reading, and says per monitor.
   */
  daylight?: () => number;
  /**
   * The frame rate and resolution to draw at (`common/scenePerformance.ts`).
   * Absent, the listener's choice from this window's store is read; the
   * desktop's page has no store and is handed main's copy.
   */
  performance?: IScenePerformance;
  /**
   * Stop drawing, and keep everything built and the last frame where it is.
   * The desktop's own pause: a background on a monitor no part of whose
   * desktop is in sight draws nothing, reads no music and costs no GPU time,
   * while the picture it had stays on the desktop. Taking the scene down
   * instead — which is what a scene nobody can see does on the graph — would
   * leave the desktop black under the window that covered it, and put the
   * picture back only after a whole build.
   */
  asleep?: boolean;
  /**
   * The picture off the screen while the graph that frames it is on its way
   * somewhere else — a scene on a layer of the window, while the window
   * changes size for full screen (`graphArrival.ts`). It keeps drawing, and
   * comes back on the first frame drawn once let go.
   */
  held?: boolean;
  /** A scene-only recording needs complete frames even when its view is
   * scrolled away. Document hiding still stops all drawing. */
  captureFrames?: boolean;
  /** Native recording pixels; never enlarge a thumbnail after rendering. */
  captureSize?: { width: number; height: number };
  /**
   * How the scene's first frames come in. `fade`, the default, rises from
   * nothing over a quarter second — a scene arriving on an empty panel.
   * `at-once` starts at full strength, for a drawing that takes over a
   * picture already on screen: a graph look, which the page draws while the
   * engine builds it and hands over on the engine's first frame. Faded in,
   * the look dipped to a sixth of itself at the handover and came back — a
   * blink on every change of look (Ivan, 2026-09-28: "B shows then it blinks
   * show again"). Both fades: the scene's own, and its canvas's on the first
   * picture it shows (`createSceneWorkerClient`).
   */
  arrival?: 'fade' | 'at-once';
  /**
   * The pack each time a version of it becomes the one being drawn — the
   * graph's menu starts its attack and release from what the scene came with.
   */
  onLoaded?: (pack: IScenePack) => void;
  /**
   * Whether the canvas is waiting for a picture: from the moment a version is
   * asked for with nothing of this scene on screen — the first build, a new
   * scene, or one put away until somebody can see it — until its first frame
   * with anything in it is drawn, or until the runner gives up on it, which
   * it says before telling the source why.
   * Nothing else knows: a worker let go while the window was covered and built
   * again when it came back leaves a component that only watched for its
   * first frame believing it was drawing all along.
   */
  onWaiting?: (waiting: boolean) => void;
  /**
   * Whether a new version of the scene on screen is being built beside it:
   * the running picture goes on playing meanwhile and is replaced the moment
   * the new one is ready, or stays if the new one does not compile. Not a
   * wait — there is a picture — so a place that covers the canvas while it
   * waits keeps it in view for this (Ivan, 2026-11-07: "can be reload on hot
   * so we see them more smolty").
   */
  onUpdating?: (updating: boolean) => void;
  /**
   * The viewer's hands on this surface (`sceneInteraction.ts`): the pointer,
   * taps and the camera the scene's `camera` limits allow. Absent, a scene
   * is pointed at by nobody and seen from where its author put the camera.
   */
  interaction?: ISceneInteraction;
  /**
   * Every frame the moment it is made, before the GPU is asked for it: what
   * the scene gets, what it heard before its response bent it, and the
   * musical accent's envelope as the scene last drew it. For what has to keep
   * up with the sound rather than with the picture - the Studio's meters,
   * which fed from the drawn frame were a GPU's round trip behind the music,
   * and not moved at all by a frame the GPU skipped.
   */
  onHeard?: (
    frame: ISceneFrame,
    heard: ISceneFrame,
    musicAccent: number,
  ) => void;
  /**
   * After every drawn frame: what the scene got, the ladder's scale, the
   * musical accent's envelope the scene was given, what it heard before its
   * response bent it, and what the frame cost.
   */
  onDrawn?: (
    frame: ISceneFrame,
    scale: number,
    musicAccent: number,
    heard: ISceneFrame,
    report: ISceneDrawReport,
  ) => void;
}
