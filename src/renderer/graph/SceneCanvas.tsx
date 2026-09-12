import { useMemo } from 'react';
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
import { createCostLadder } from './sceneHealth';
import { createWarmupLadder } from './sceneWarmup';
import useSceneRunner, { type ISceneSource } from './useSceneRunner';

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

  const canvasRef = useSceneRunner({ source, width, height, spectrumRect });

  return (
    <canvas
      ref={canvasRef}
      className="chart-scene-canvas"
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}
