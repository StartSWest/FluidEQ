import type { IScenePack } from 'common/scenePacks';
import type { IScenePerformance } from 'common/scenePerformance';
import type { TSceneFailure } from 'main/scenePackStore';
import type { ISceneFrame } from './sceneGl';
import type { TSceneMaker } from './sceneFlashGuard';
import type { ICostLadder } from './sceneHealth';
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
 * Where a scene comes from and what to do when it cannot run — the only thing
 * that differs between an official look on the graph, a member's look on the
 * graph, and the Studio's live stage. The runner (`useSceneRunner.ts`) is the
 * same for all three, so a member's scene is drawn by exactly the code an
 * official one is, plus the two safeguards its source asks for.
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
   * `top` is the largest scale the ladder may reach: 1 for the panel's own
   * pixels, more when `best` smoothing draws the scene larger than the panel.
   * `floor` is the smallest the listener allows (`autoFloor`): below it the
   * ladder slows the frame rate rather than the picture.
   */
  createLadder(top: number, floor: number): ICostLadder;
  /** Present only for scenes drawn through the brightness limiter. */
  madeBy: TSceneMaker;
  /**
   * Compile the scene's program while it is out of sight, so it is ready the
   * moment it is shown (`warmSceneProgram`). The graph's look, which somebody
   * opening the window expects to see at once; not a gallery of previews,
   * which would compile every card at once. FluidEQ's own scenes only: a
   * member's shader reaches the GPU's compiler when somebody looks at it,
   * never at launch while the graph sits on another tab.
   */
  warmWhenUnseen?: boolean;
  /**
   * Ease to thirty frames a second once nothing has played for a while
   * (`sceneRest.ts`): the graph's look and the desktop, which are left
   * running for hours. Not the Studio's stage or a preview, where somebody
   * is judging the motion of a scene that may have no music at all.
   */
  restsInSilence?: boolean;
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
   * After every drawn frame: what the scene got, the ladder's scale, the
   * musical accent's envelope the scene was given, what it heard before its
   * response bent it — the Studio's meters show both — and what the frame
   * cost.
   */
  onDrawn?: (
    frame: ISceneFrame,
    scale: number,
    musicAccent: number,
    heard: ISceneFrame,
    report: ISceneDrawReport,
  ) => void;
}
