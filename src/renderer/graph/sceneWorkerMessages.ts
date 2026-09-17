import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';
import type { ISceneCostReading } from './sceneHealth';

export interface ISceneDrawSize {
  width: number;
  height: number;
}

/** How the drawn picture is finished before it is shown (`scenePost.ts`). */
export interface ISceneFinish {
  /** Bring a smaller picture up with FSR; otherwise leave it small. */
  fsr: boolean;
  /** Smooth edges with FXAA at the size the canvas shows. */
  fxaa: boolean;
}

export type TSceneWorkerRequest =
  /** First, and once: the page's canvas, which this worker now draws on. */
  | { kind: 'attach'; canvas: OffscreenCanvas }
  | { kind: 'load'; id: number; pack: IScenePack; guarded: boolean }
  /** Give up any load, free everything, then answer `retired`. */
  | { kind: 'retire' }
  | {
      kind: 'draw';
      /**
       * What the scene hears. Its `timeSeconds` and `deltaMs` are the page's
       * own bookkeeping; the worker keeps the clock the scene is drawn on,
       * because only the worker is still drawing while the page is stalled.
       */
      frame: ISceneFrame;
      /** The pixels the scene is drawn at: the panel's, fewer, or more. */
      width: number;
      height: number;
      /**
       * The panel's own pixels. When they differ from the drawn size, the
       * picture is brought to them on the GPU before it is shown — or left
       * small for the compositor to stretch, when `finish` says so.
       */
      output: ISceneDrawSize;
      finish: ISceneFinish;
      clip: readonly [number, number, number, number];
      /**
       * The least time the page leaves between frames, 0 for every frame the
       * display offers: the pace the worker keeps when the page falls behind,
       * and how it tells a page that fell behind from one that is pacing.
       */
      paceMs: number;
    }
  /**
   * The page's frame loop has stopped — hidden, out of sight, nothing to
   * draw — so the worker stops filling in frames until the next `draw`.
   */
  | { kind: 'idle' };

export type TSceneBuildResult =
  | { kind: 'ready'; rebuilt: boolean }
  | { kind: 'compile'; log: string }
  | { kind: 'unavailable' }
  | { kind: 'cancelled' };

export type TSceneWorkerReply =
  | { kind: 'loaded'; id: number; result: TSceneBuildResult }
  | {
      /** Submitted: the frame is on its way to the screen. */
      kind: 'drawn';
      accent: number;
      /**
       * What the GPU has been costing (`sceneGpuClock.ts`): the newest frame
       * it finished, and how many it still had in hand when this one came.
       */
      cost: ISceneCostReading;
      /**
       * Not drawn: the GPU already held two frames, and a third would only
       * queue. The page's next frame tries again.
       */
      skipped: boolean;
    }
  | {
      kind: 'lost';
      /** The scene is not given its context back again. */
      fatal: boolean;
      /** Its own frame held the GPU right before the loss (`BLAMED_FRAME_MS`). */
      blamed: boolean;
    }
  | { kind: 'restored' }
  /** Nothing is linking and nothing is held: the worker may be ended. */
  | { kind: 'retired' }
  | { kind: 'error'; log: string };
