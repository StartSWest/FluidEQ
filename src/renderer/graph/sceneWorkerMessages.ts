import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';

export type TSceneWorkerRequest =
  /** First, and once: the page's canvas, which this worker now draws on. */
  | { kind: 'attach'; canvas: OffscreenCanvas }
  | { kind: 'load'; id: number; pack: IScenePack; guarded: boolean }
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
  | { kind: 'lost'; fatal: boolean }
  | { kind: 'restored' }
  | { kind: 'error'; log: string };
