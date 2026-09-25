import type { IScenePack } from 'common/scenePacks';
import type { IStudioAgentMoment, TStudioAgentSound } from 'common/studioAgent';
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
      /**
       * PNG instead of the gallery's WebP, for the picture written beside a
       * project so the member's AI can look at what it just made: it is read
       * by whatever assistant they use, and PNG is the one every one of them
       * opens. It never travels, so the size a WebP saves buys nothing here.
       */
      format?: 'png';
    }
  | {
      kind: 'sample';
      id: number;
      pack: IScenePack;
      accent: readonly [number, number, number];
    }
  | {
      /**
       * A picture the member's AI asked for over the Studio's agent door:
       * any of the shapes a panel takes, under the test music or silence, at
       * a moment of the caller's choosing, and the driver's own words when
       * the shader does not compile.
       */
      kind: 'agent';
      id: number;
      pack: IScenePack;
      accent: readonly [number, number, number];
      width: number;
      height: number;
      sound: TStudioAgentSound;
      seconds?: number;
      /** The test music's tempo, when not its own. */
      tempo?: number;
      spectrumRect: readonly [number, number, number, number];
      /** The window cannot be seen: link without waiting on frames. */
      unseen: boolean;
      /** `uCamera` for every frame, already inside the scene's limits. */
      camera?: readonly [number, number, number];
      /** Where the pointer rests, and whether it is pressed. */
      pointer?: { x: number; y: number; pressed: boolean };
      /** A tap this many seconds before the picture. */
      tap?: { x: number; y: number; seconds: number };
    };

/**
 * The page telling the worker whether it can be seen, as that changes: not a
 * request, answered by nothing and queued behind nothing, because the one it
 * matters to is a link already waiting on frames that stopped coming.
 */
export interface ISceneStillVisibility {
  kind: 'visibility';
  hidden: boolean;
}

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
    }
  | {
      kind: 'agent';
      id: number;
      /** A JPEG of the size asked for. */
      image?: Blob;
      /** The GPU's time for the kept frame, at `renderWidth` x `renderHeight`. */
      drawMs?: number;
      renderWidth?: number;
      renderHeight?: number;
      /** What the music was doing at the kept frame. */
      moment?: IStudioAgentMoment;
      /** The shader did not compile, in the driver's words. */
      log?: string;
      /** It built, and its frame would take this computer far too long. */
      hopeless?: true;
      refused?: TSceneStillRefusal;
    };
