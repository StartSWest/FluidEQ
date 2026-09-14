import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';

export type TSceneWorkerRequest =
  /** First, and once: the page's canvas, which this worker now draws on. */
  | { kind: 'attach'; canvas: OffscreenCanvas }
  | { kind: 'load'; id: number; pack: IScenePack; guarded: boolean }
  /** Give up any load, free everything, then answer `retired`. */
  | { kind: 'retire' }
  | {
      kind: 'draw';
      frame: ISceneFrame;
      width: number;
      height: number;
      clip: readonly [number, number, number, number];
    };

export type TSceneBuildResult =
  | { kind: 'ready'; rebuilt: boolean }
  | { kind: 'compile'; log: string }
  | { kind: 'unavailable' }
  | { kind: 'cancelled' };

export type TSceneWorkerReply =
  | { kind: 'loaded'; id: number; result: TSceneBuildResult }
  | {
      /** Committed: the frame is on its way to the screen. */
      kind: 'drawn';
      accent: number;
      /** What drawing this frame cost the GPU, measured in the worker. */
      costMs: number;
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
