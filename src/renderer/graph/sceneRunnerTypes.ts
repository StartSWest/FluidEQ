import type { IScenePack } from 'common/scenePacks';
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
  /** The scene itself failed here. `log` is the driver's message. */
  reportFailure(reason: 'compile' | 'context-lost', log?: string): void;
  /** Too slow even at the ladder's floor. */
  tooSlow(): void;
  createLadder(): ICostLadder;
  /** Present only for scenes drawn through the brightness limiter. */
  createGuard?: (gl: WebGL2RenderingContext) => IFlashGuard | null;
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
