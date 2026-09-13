import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  reportOwnResponse,
  useListenerResponse,
} from '../utils/sceneResponseStore';
import {
  blockScene,
  loadScenePack,
  reportSceneFailure,
  type IUsableScene,
} from '../utils/scenePacks';
import {
  blockMemberScene,
  loadMemberScene,
  reportMemberSceneFailure,
  type IUsableMemberScene,
} from '../utils/memberScenes';
import { createFlashGuard } from './sceneFlashGuard';
import type { ISceneFrame } from './sceneGl';
import SceneLoading from './SceneLoading';
import { createCostLadder } from './sceneHealth';
import { createWarmupLadder } from './sceneWarmup';
import useSceneRunner, { type ISceneSource } from './useSceneRunner';
import { reportSceneBeat } from '../utils/scenePulse';

export type TDrawableScene = IUsableScene | IUsableMemberScene;

interface ISceneCanvasProps {
  scene: TDrawableScene;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
}

const isMemberScene = (scene: TDrawableScene): scene is IUsableMemberScene =>
  'kind' in scene && scene.kind === 'member';

/**
 * A Plus look, or a member's scene, drawn on the GPU.
 *
 * A sibling of `LiveTraceCanvas` and mounted INSTEAD of it, never alongside:
 * two canvases painting the same region is double the fill for a picture that
 * is worse. The loop itself is `useSceneRunner`; what this decides is where
 * the scene comes from and what failing means for it.
 *
 * EVERY FAILURE PATH IS THE SAME PATH. A shader that will not compile, a GPU
 * context lost, a machine too slow at the ladder's floor — each reports the
 * scene unusable to its store, `useSceneLook` answers null, and the chart
 * mounts the 2D canvas with the scene's own fallback form. Nothing here draws
 * an error; the fallback form is the error state, and it is a working
 * visualizer.
 *
 * A member's scene differs in exactly two ways: it warms up from an eighth of
 * the size instead of starting at full, and it is drawn through the brightness
 * limiter. Nobody watched it before it reached this screen.
 */
export default function SceneCanvas({
  scene,
  width,
  height,
  spectrumRect,
}: ISceneCanvasProps) {
  const member = isMemberScene(scene);
  const key = member ? scene.lookId : scene.id;
  const version = scene.revision ?? String(scene.version);
  const name = scene.names.en;
  const source = useMemo<ISceneSource>(
    () =>
      member
        ? {
            identity: key,
            version: String(version),
            name,
            load: () => loadMemberScene(key),
            block: () => blockMemberScene(key),
            reportFailure: (reason) => {
              reportMemberSceneFailure(key, reason).catch(() => undefined);
            },
            tooSlow: () => blockMemberScene(key),
            createLadder: createWarmupLadder,
            createGuard: createFlashGuard,
          }
        : {
            identity: key,
            version: String(version),
            name,
            load: () => loadScenePack(key),
            block: () => blockScene(key),
            reportFailure: (reason) => {
              reportSceneFailure(key, reason).catch(() => undefined);
            },
            // A slow session is a fact about the machine right now, not about
            // the pack: fall back until the next launch, write nothing down.
            tooSlow: () => blockScene(key),
            createLadder: createCostLadder,
          },
    [member, key, version, name],
  );

  // Which scene has drawn its first frame. Kept by identity, because the
  // chart hands this same canvas the next scene when the look changes, and
  // that one starts from nothing again; a new version of the same scene is
  // swapped in place and stays settled.
  const [drawnIdentity, setDrawnIdentity] = useState<string>();
  const drawnRef = useRef<string | undefined>(undefined);
  // The element the scene draws in, once the runner has made it: where the
  // window's pulse starts from.
  const hostRef = useRef<RefObject<Element | null>>(undefined);
  const onDrawn = useCallback(
    (frame: ISceneFrame) => {
      if (frame.fade > 0 && drawnRef.current !== key) {
        drawnRef.current = key;
        setDrawnIdentity(key);
      }
      // The window beats on the beats this scene is drawing, when the
      // graph's mode asks it to (`ScenePulse.tsx`).
      reportSceneBeat('graph', frame, hostRef.current?.current);
    },
    [key],
  );

  // The listener's own attack and release for this visualizer, from the
  // graph's menu, over the timing its pack came with.
  const { lookId } = scene;
  const chosen = useListenerResponse(lookId);
  const tuning = useMemo(
    () => (chosen ? { response: chosen } : undefined),
    [chosen],
  );
  const onLoaded = useCallback(
    (pack: IScenePack) => reportOwnResponse(lookId, pack.response),
    [lookId],
  );

  const sceneRef = useSceneRunner({
    source,
    width,
    height,
    spectrumRect,
    tuning,
    onDrawn,
    onLoaded,
  });
  hostRef.current = sceneRef;

  return (
    <>
      <SceneLoading
        lookId={lookId}
        swatch={scene.swatch}
        settled={drawnIdentity === key}
        width={width}
        height={height}
      />
      <canvas
        ref={sceneRef}
        className="chart-scene-canvas"
        aria-hidden="true"
        style={{ width, height }}
      />
    </>
  );
}
