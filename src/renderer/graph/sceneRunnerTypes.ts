import type { TSceneMaker } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
import type { IScenePerformance } from 'common/scenePerformance';
import type { TSceneFailure } from 'main/scenePackStore';
import type { ISceneFrame } from './sceneGl';
import type { ISceneInteraction } from './sceneInteraction';
import type { ISceneTuning } from './sceneTuner';

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
  /** The pixels the scene was drawn at, and the panel's own. */
  drawnWidth: number;
  drawnHeight: number;
  outputWidth: number;
  outputHeight: number;
  /** How the picture was finished: FSR up to size, FXAA over it. */
  fsr: boolean;
  fxaa: boolean;
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
   * outlives the build; `context-lost` is two losses nothing was blamed for.
   */
  reportFailure(reason: TSceneFailure, log?: string): void;
  /** Too slow even at the ladder's floor. */
  tooSlow(): void;
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
  /** Replaces what the scene hears — the Studio's test signals. */
  shapeFrame?: (frame: ISceneFrame) => ISceneFrame;
  /** Read every frame, so moving a slider moves the scene at once. */
  tuning?: ISceneTuning;
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
   * The pack each time a version of it becomes the one being drawn — the
   * graph's menu starts its attack and release from what the scene came with.
   */
  onLoaded?: (pack: IScenePack) => void;
  /**
   * Whether a version is on its way that is not on the canvas yet: from the
   * moment it is asked for — built beside a running one, built with nothing on
   * screen, or put away until somebody can see it — until its first frame
   * with anything in it is drawn, or until the runner gives up on it, which it
   * says before telling the source why.
   * Nothing else knows: a worker let go while the window was covered and built
   * again when it came back leaves a component that only watched for its
   * first frame believing it was drawing all along.
   */
  onWaiting?: (waiting: boolean) => void;
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
