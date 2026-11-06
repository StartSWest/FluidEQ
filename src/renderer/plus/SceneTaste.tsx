import { useEffect, useRef } from 'react';
import { PLUS_TASTE_SECONDS } from 'common/plusTerms';
import { useTranslation } from '../utils/I18nContext';

/**
 * How long a member watches a scene they do not own play on its page before
 * the way to get it. The number lives with the terms, which quote it, and is
 * the length of the clip the Studio records when a scene is published.
 */
export const TASTE_SECONDS = PLUS_TASTE_SECONDS;

interface ISceneTasteProps {
  /** The clip, as an object URL the page made and will revoke. */
  url: string;
  /** Its first frame is on screen: the page's picture can step behind it. */
  onShown: () => void;
  /** It ran to its end, or could not play: the page shows the way to get it. */
  onOver: () => void;
}

/**
 * A scene's published clip playing on its page for a member who does not own
 * it — silent, once — with a line filling across the stage as it runs. The
 * scene itself is never sent to them: its code goes to its owners alone
 * (premium 0085), and this is the ten seconds the Studio recorded instead.
 *
 * The line follows the frames actually painted (requestVideoFrameCallback),
 * so a window put away half way through holds it where it was.
 */
export default function SceneTaste({ url, onShown, onOver }: ISceneTasteProps) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  const overRef = useRef(onOver);
  overRef.current = onOver;

  useEffect(() => {
    const element = video.current;
    if (!element) {
      return undefined;
    }
    let shown = false;
    let callback = 0;
    // Written straight to the bar, not through state: a component that
    // re-rendered every frame would cost the page around it.
    const painted = (_now: number, frame: VideoFrameCallbackMetadata) => {
      if (!shown) {
        shown = true;
        shownRef.current();
      }
      const share =
        element.duration > 0
          ? Math.min(1, Math.max(0, frame.mediaTime / element.duration))
          : 0;
      if (fill.current) {
        fill.current.style.transform = `scaleX(${share})`;
      }
      callback = element.requestVideoFrameCallback(painted);
    };
    callback = element.requestVideoFrameCallback(painted);
    return () => element.cancelVideoFrameCallback(callback);
  }, [url]);

  return (
    <>
      <video
        ref={video}
        className="gallery-preview__clip"
        src={url}
        aria-label={t('plus.scene.playing')}
        muted
        playsInline
        autoPlay
        disablePictureInPicture
        onEnded={() => overRef.current()}
        onError={() => overRef.current()}
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
