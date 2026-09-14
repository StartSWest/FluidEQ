import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';

/**
 * What the page asks the scene still worker for, and what it answers.
 *
 * A picture is either the showcase's kick (`frames` absent) or a moment a
 * member caught (`frames`, oldest first). A sample is the showcase read back
 * small, for the window's tint to be measured from.
 */
export type TSceneStillRequest =
  | {
      kind: 'still';
      id: number;
      pack: IScenePack;
      accent: readonly [number, number, number];
      frames?: readonly ISceneFrame[];
    }
  | {
      kind: 'sample';
      id: number;
      pack: IScenePack;
      accent: readonly [number, number, number];
    };

/**
 * Why a worker gave a scene up: its context was lost right after one of its
 * own frames held the GPU (`gpu-reset`), lost with nothing to blame
 * (`context-lost`), or a frame took far too long (`too-heavy`).
 */
export type TSceneStillRefusal = 'context-lost' | 'gpu-reset' | 'too-heavy';

/**
 * Undefined `blob` or `pixels`: this machine could not draw the scene.
 * `refused`: and it must not be asked to again this session, and why.
 */
export type TSceneStillReply =
  | { kind: 'still'; id: number; blob?: Blob; refused?: TSceneStillRefusal }
  | {
      kind: 'sample';
      id: number;
      pixels?: Uint8Array;
      refused?: TSceneStillRefusal;
    };
