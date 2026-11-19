import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { ISceneCameraLimits } from 'common/sceneCamera';
import { useCameraKeyName } from '../graph/cameraKeyName';
import { useTranslation } from '../utils/I18nContext';
import { useSceneCameraControl } from '../utils/sceneCameraControlStore';
import SceneMoveMark from './SceneMoveMark';
import { sceneMoveRows } from './sceneMoveGestures';
import '../styles/SceneMove.scss';

/**
 * The keys that move a 3D scene, in a tip over the 3D label of a gallery
 * card or of a scene's own page: the viewer's own key (Ctrl unless they
 * chose another), each gesture with it, and where the key is chosen.
 *
 * The app's tooltips are words (`tooltipLayer.ts`), and these are keys, so
 * this one is a popover of its own on the tooltip's face. In the top layer,
 * so a card's rounded clip and the stage's frame cannot cut it, and placed
 * by the browser against its label (`anchor-name`), flipping to whichever
 * side has room, so it is never cut by the window's edge either.
 */

export interface IMoveTip {
  /** The tip's id, for the label's `aria-describedby`. */
  id: string;
  /** The label's style: the anchor the tip is placed against. */
  anchorStyle: CSSProperties;
  tipRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** One tip and its label's half of it. */
export const useMoveTip = (): IMoveTip => {
  const reactId = useId();
  // `useId`'s characters are not all a CSS name's.
  const id = `scene-move-${reactId.replace(/[^\w-]/g, '')}`;
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const tip = tipRef.current;
    // jsdom has no popover; the tests read the tip's words from the tree.
    if (!tip || !('showPopover' in tip)) {
      return;
    }
    if (open !== tip.matches(':popover-open')) {
      tip.togglePopover(open);
    }
  }, [open]);
  return {
    id,
    anchorStyle: { anchorName: `--${id}` } as CSSProperties,
    tipRef,
    open,
    setOpen,
  };
};

interface ISceneMoveTipProps {
  tip: IMoveTip;
  limits: ISceneCameraLimits;
}

export default function SceneMoveTip({ tip, limits }: ISceneMoveTipProps) {
  const { t } = useTranslation();
  const key = useCameraKeyName();
  const { move } = useSceneCameraControl();
  return (
    <div
      ref={tip.tipRef}
      id={tip.id}
      role="tooltip"
      popover="manual"
      className="scene-move-tip"
      style={{ positionAnchor: `--${tip.id}` } as CSSProperties}
    >
      <p className="scene-move-tip__title">
        <SceneMoveMark />
        {t('plus.move.title')}
      </p>
      <dl className="scene-move-tip__rows">
        {sceneMoveRows(limits, move).map(({ gesture, does }) => (
          <div key={does} className="scene-move-tip__row">
            <dt className="scene-move-tip__keys">
              <kbd className="scene-move-key">{key}</kbd>
              {gesture && (
                <>
                  <span aria-hidden="true">+</span>
                  <span>{t(gesture)}</span>
                </>
              )}
            </dt>
            <dd>{t(does, { reset: t('graph.scene.resetView') })}</dd>
          </div>
        ))}
      </dl>
      <p className="scene-move-tip__where">{t('tour.camera.how')}</p>
    </div>
  );
}
