import { useCallback, useRef, type RefObject } from 'react';
import type { Translate } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import type { TStageDrawn } from './StudioStage';
import { createStudioReadingSettler } from './studioReading';

/**
 * The reading at its widest, for the box it is written into (`LiveFigure`):
 * two figures for the GPU's milliseconds, three for the rate and the size.
 * The rate-only line is the same words less the milliseconds, so never wider.
 */
export const widestStudioReadings = (t: Translate) => [
  t('studio.cost.reading', { ms: '00.0', fps: '000', size: '000' }),
];

/**
 * The stage's frame callback: each frame goes on to the meters, and what it
 * cost is read out on the test card and in the stage's own corner.
 */
export default function useStudioReading(
  /** The meters' own writer (`StudioMeters.tsx`), handed every frame first. */
  feed: RefObject<TStageDrawn | undefined>,
) {
  const { t } = useTranslation();
  // What the frames cost, under the cost line: the GPU's own time for a
  // frame, the rate they are drawn at, and the size the controller has the
  // scene at — what Automatic is doing, which nothing else on the stage
  // says. Written to the element straight from the frame callback, never
  // through React, and settled first (`studioReading.ts`) so the figures can
  // be read instead of blurring.
  const readingRef = useRef<HTMLSpanElement>(null);
  // The same figures in the corner of the stage, where the author is already
  // looking. Its own element rather than one moved about, because the card
  // keeps its reading whether the stage is showing one or not.
  const stageReadingRef = useRef<HTMLSpanElement>(null);
  const settler = useRef(createStudioReadingSettler());
  const onDrawn = useCallback<TStageDrawn>(
    (frame, drawnScale, accent, heard, report) => {
      feed.current?.(frame, drawnScale, accent, heard, report);
      // The clock is read here, at the frame, so the rate on the card is the
      // rate frames are arriving at rather than the runner's own estimate of
      // the display's beat.
      const settled = settler.current.frame({
        ...report,
        atMs: performance.now(),
      });
      const fps = String(settled.fps);
      const size = String(settled.size);
      const reading =
        settled.costMs === undefined
          ? t('studio.cost.readingRate', { fps, size })
          : t('studio.cost.reading', {
              ms: settled.costMs.toFixed(1),
              fps,
              size,
            });
      // Each element against its OWN text, not against one remembered figure:
      // the stage's corner comes and goes with the stage, and a single
      // remembered value left a corner that had just appeared blank until the
      // reading happened to change — over a scene that was plainly playing.
      [readingRef.current, stageReadingRef.current].forEach((node) =>
        writeLiveText(node, reading),
      );
    },
    [feed, t],
  );
  return { readingRef, stageReadingRef, onDrawn };
}
