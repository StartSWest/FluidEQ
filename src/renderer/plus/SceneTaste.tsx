import { useCallback, useRef } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from '../graph/sceneGl';
import { useTranslation } from '../utils/I18nContext';
import ScenePreview, { type TPreviewTrouble } from './ScenePreview';

/** How long a member without Plus watches a scene play on its page. */
export const TASTE_SECONDS = 10;

interface ISceneTasteProps {
  identity: string;
  pack: IScenePack;
  onTrouble: (trouble: TPreviewTrouble) => void;
  /** The taste is over: the page shows the picture and the way into Plus. */
  onOver: () => void;
}

/**
 * A scene playing on its page for a member without Plus — for ten seconds
 * of it actually being drawn, so they see what it does before they are
 * asked for anything — with a line filling across the stage as it runs.
 *
 * Counted on the scene's own clock, which only moves while frames are
 * drawn: a window put away half way through does not use the rest up.
 */
export default function SceneTaste({
  identity,
  pack,
  onTrouble,
  onOver,
}: ISceneTasteProps) {
  const { t } = useTranslation();
  const started = useRef<number | undefined>(undefined);
  const done = useRef(false);
  const fill = useRef<HTMLSpanElement>(null);
  const overRef = useRef(onOver);
  overRef.current = onOver;

  // Written straight to the bar, not through state: a component that
  // re-rendered sixty times a second would cost the scene beside it.
  const onDrawn = useCallback((frame: ISceneFrame) => {
    started.current = started.current ?? frame.timeSeconds;
    const elapsed = frame.timeSeconds - started.current;
    const share = Math.min(1, Math.max(0, elapsed / TASTE_SECONDS));
    if (fill.current) {
      fill.current.style.transform = `scaleX(${share})`;
    }
    if (share >= 1 && !done.current) {
      done.current = true;
      overRef.current();
    }
  }, []);

  return (
    <>
      <ScenePreview
        identity={identity}
        pack={pack}
        label={t('plus.scene.playing')}
        onTrouble={onTrouble}
        onDrawn={onDrawn}
      />
      <span className="gallery-preview__tag">
        <span className="gallery-preview__live" aria-hidden="true" />
        {t('plus.scene.taste', { seconds: TASTE_SECONDS })}
      </span>
      <span className="gallery-taste" aria-hidden="true">
        <span ref={fill} className="gallery-taste__fill" />
      </span>
    </>
  );
}
