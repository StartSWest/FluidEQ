import type { ISceneCameraLimits } from 'common/sceneCamera';
import { useCameraKeyName } from '../graph/cameraKeyName';
import { useTranslation } from '../utils/I18nContext';
import SceneMoveMark from './SceneMoveMark';
import SceneMoveTip, { type IMoveTip } from './SceneMoveTip';

interface IGalleryMoveTagProps {
  limits: ISceneCameraLimits;
  /** The card's tip, whose id its picture's button is described by. */
  tip: IMoveTip;
}

/**
 * "3D" and the key that moves it, at the top right of a card's words, beside
 * the name (Ivan, 2026-11-19: "a label that says the scene can be moved with
 * the control ... at the right top corner of the bottom part of the card").
 * The pointer resting on it shows the gestures. Not a stop of its own for
 * Tab - sixty cards would be sixty more - so the card's picture, which is,
 * is described by the same tip instead.
 */
export default function GalleryMoveTag({ limits, tip }: IGalleryMoveTagProps) {
  const { t } = useTranslation();
  const key = useCameraKeyName();
  // The tip beside the label rather than in it: a popover is a block, and
  // until it opens it takes no room in the row.
  return (
    <>
      <span
        className="scene-move-tag"
        style={tip.anchorStyle}
        onPointerEnter={() => tip.setOpen(true)}
        onPointerLeave={() => tip.setOpen(false)}
      >
        <SceneMoveMark />
        <span className="scene-move-tag__label">{t('plus.move.badge')}</span>
        <kbd className="scene-move-key">{key}</kbd>
      </span>
      <SceneMoveTip tip={tip} limits={limits} />
    </>
  );
}
