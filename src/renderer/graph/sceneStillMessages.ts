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

/** Undefined `blob` or `pixels`: this machine could not draw the scene. */
export type TSceneStillReply =
  | { kind: 'still'; id: number; blob?: Blob }
  | { kind: 'sample'; id: number; pixels?: Uint8Array };
