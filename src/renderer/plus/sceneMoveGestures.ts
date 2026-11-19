import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import {
  rangeMoves,
  turnsRound,
  type ISceneCameraLimits,
} from 'common/sceneCamera';
import type { TSceneCameraMove } from 'common/sceneCameraControl';

/**
 * What the viewer's hands can do to a 3D scene, as the gallery tells it
 * before the scene is bought (Ivan, 2026-11-19: "a label that says the scene
 * can be moved with the control ... a tooltip ... it will tell the
 * shortcuts"). Read from the same limits the camera obeys
 * (`sceneInteraction.ts`), so nothing is promised that the scene refuses:
 * a scene whose author let it tilt alone is not said to turn, and one with
 * no zoom range has no wheel row.
 */

/** One row of the gestures: the gesture after the key, and what it does. */
export interface ISceneMoveRow {
  /** Undefined for the key held alone. */
  gesture?: TranslationKey;
  does: TranslationKey;
}

const GESTURE: Record<TSceneCameraMove, TranslationKey> = {
  drag: 'plus.move.drag',
  move: 'plus.move.mouse',
};

/** How the scene turns: a whole circle, part of one, or only up and down. */
const turnOf = (limits: ISceneCameraLimits): TranslationKey | undefined => {
  if (rangeMoves(limits.yaw)) {
    return turnsRound(limits) ? 'plus.move.round' : 'plus.move.turn';
  }
  return rangeMoves(limits.pitch) ? 'plus.move.tilt' : undefined;
};

/**
 * The rows for a scene, in the order a hand meets them: turning, the wheel,
 * and the key alone, which brings back Reset view once the scene has moved
 * (`SceneViewReset`).
 */
export const sceneMoveRows = (
  limits: ISceneCameraLimits,
  move: TSceneCameraMove,
): ISceneMoveRow[] => {
  const turn = turnOf(limits);
  return [
    ...(turn ? [{ gesture: GESTURE[move], does: turn }] : []),
    ...(rangeMoves(limits.zoom)
      ? [
          {
            gesture: 'plus.move.wheel' as const,
            does: 'plus.move.zoom' as const,
          },
        ]
      : []),
    { does: 'plus.move.reset' },
  ];
};

/**
 * How far a listed scene's camera moves, from the best source there is:
 * the listing's own word for the version listed, or else the pack on this
 * computer, which an owner has and a buyer does not.
 */
export const galleryCameraOf = (
  scene: Pick<IGalleryScene, 'camera'>,
  local: { camera?: ISceneCameraLimits } | undefined,
): ISceneCameraLimits | undefined => scene.camera ?? local?.camera;
