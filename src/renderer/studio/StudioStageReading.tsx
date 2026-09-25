import type { RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import { widestStudioReadings } from './useStudioReading';

interface IStudioStageReadingProps {
  /** How the scene is keeping up: the same verdict the card under it shows. */
  cost: TranslationKey;
  /** The size the controller has the scene at, for the verdict's own sentence. */
  percent: number;
  /**
   * Written to straight from the frame callback, never through React: at the
   * display's rate, a state update per frame is the most expensive thing on
   * the page and would change the very numbers it is reporting.
   */
  readingRef: RefObject<HTMLSpanElement | null>;
}

/**
 * How the scene is doing, in the corner of the Studio's own stage.
 *
 * The same light, words and figures as the card down the side column, put
 * where the author is already looking. Judging a scene means watching it, and
 * the reading that says whether it is keeping up was three hundred pixels
 * away from the picture it was about — so the two were never seen together,
 * and the moment a change made the scene heavy went unnoticed until somebody
 * happened to glance aside.
 *
 * The Studio's stage only. A listener is watching a scene, not building one,
 * and a figure over the picture is the author's tool.
 */
export default function StudioStageReading({
  cost,
  percent,
  readingRef,
}: IStudioStageReadingProps) {
  const { t } = useTranslation();
  return (
    <span
      className={`studio-stage__reading studio-cost studio-cost--${cost
        .split('.')
        .pop()}`}
      // Nothing here takes a press, and the stage under it is double-clicked
      // to go full screen: a corner that swallowed that would be a corner of
      // the scene that behaves differently from the rest of it.
      aria-hidden="true"
    >
      <span className="studio-cost__dot" />
      {t(cost, { percent })}
      <LiveFigure
        className="studio-cost__reading"
        widest={widestStudioReadings(t)}
        textRef={readingRef}
      />
    </span>
  );
}
