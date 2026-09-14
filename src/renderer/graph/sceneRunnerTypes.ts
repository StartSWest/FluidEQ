import type { IScenePack } from 'common/scenePacks';
import type { TSceneFailure } from 'main/scenePackStore';
import type { ISceneFrame } from './sceneGl';
import type { IFlashGuard } from './sceneFlashGuard';
import type { ICostLadder } from './sceneHealth';
import type { ISceneTuning } from './sceneTuner';

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
  createLadder(): ICostLadder;
  /** Present only for scenes drawn through the brightness limiter. */
  createGuard?: (gl: WebGL2RenderingContext) => IFlashGuard | null;
  /**
   * Compile the scene's program while it is out of sight, so it is ready the
   * moment it is shown (`warmSceneProgram`). The graph's look, which somebody
   * opening the window expects to see at once; not a gallery of previews,
   * which would compile every card at once. FluidEQ's own scenes only: a
   * member's shader reaches the GPU's compiler when somebody looks at it,
   * never at launch while the graph sits on another tab.
   */
  warmWhenUnseen?: boolean;
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
   * musical accent's envelope the scene was given, and what it heard before
   * its response bent it — the Studio's meters show both.
   */
  onDrawn?: (
    frame: ISceneFrame,
    scale: number,
    musicAccent: number,
    heard: ISceneFrame,
  ) => void;
}
