import type { ISceneCameraLimits } from 'common/sceneCamera';
import { useCameraKeyName } from '../graph/cameraKeyName';
import { useTranslation } from '../utils/I18nContext';
import SceneMoveMark from './SceneMoveMark';
import SceneMoveTip, { useMoveTip } from './SceneMoveTip';

interface IStageMoveBadgeProps {
  limits: ISceneCameraLimits;
}

/**
 * "3D" and its key at the top right of a scene's stage, the corner the
 * playing tag leaves free (Ivan, 2026-11-19: "on the preview put a 3D
 * something and a tooltip"). Resting the pointer on it, reaching it with
 * Tab or pressing it shows the gestures; leaving, Tab onwards or Esc puts
 * them away. A button so a keyboard reaches it and a finger can press it:
 * a press only ever shows, because a finger's press arrives after the
 * pointer has already entered, and a toggle would close what it opened.
 */
export default function StageMoveBadge({ limits }: IStageMoveBadgeProps) {
  const { t } = useTranslation();
  const key = useCameraKeyName();
  const tip = useMoveTip();
  return (
    <>
      <button
        type="button"
        className="scene-move-badge"
        style={tip.anchorStyle}
        aria-describedby={tip.id}
        onPointerEnter={() => tip.setOpen(true)}
        onPointerLeave={() => tip.setOpen(false)}
        onFocus={() => tip.setOpen(true)}
        onBlur={() => tip.setOpen(false)}
        onClick={() => tip.setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && tip.open) {
            // Only the tip: a dialog or a page under it keeps its own Esc.
            event.stopPropagation();
            tip.setOpen(false);
          }
        }}
      >
        <SceneMoveMark />
        <span className="scene-move-badge__label">{t('plus.move.badge')}</span>
        <kbd className="scene-move-key">{key}</kbd>
      </button>
      <SceneMoveTip tip={tip} limits={limits} />
    </>
  );
}
