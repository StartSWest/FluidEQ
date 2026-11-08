import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import type { TStageZoom } from './useStageZoom';

/**
 * A closer look at the stage, on its plate beside the other controls (Ivan,
 * 2026-11-08: "add icons on top, zoom the scene"): out, in, and — only while
 * closer — how close, which brings the whole picture back when pressed. The
 * plate's own drawn buttons, so the row reads as one.
 *
 * A step with nowhere further to go says so with `aria-disabled` rather than
 * `disabled`, so pressing − to the end with the keyboard keeps the focus.
 */
export default function StudioStageZoom({ zoom }: { zoom: TStageZoom }) {
  const { t } = useTranslation();
  const hint = t('studio.stage.zoomHint');
  const zoomOut = t('studio.picture.zoomOut');
  const zoomIn = t('studio.picture.zoomIn');
  const fit = t('studio.picture.fit');
  return (
    <div
      className="studio-stage-controls studio-stage-zoom"
      role="group"
      aria-label={t('studio.framing.zoom')}
    >
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-label={zoomOut}
        title={`${zoomOut}\n${hint}`}
        aria-disabled={!zoom.canZoomOut}
        onClick={() => {
          if (zoom.canZoomOut) {
            zoom.zoomOut();
          }
        }}
      >
        <Glyph name="zoom-out" />
      </button>
      {zoom.zoomed && (
        <button
          type="button"
          className="studio-stage-zoom__percent"
          aria-label={`${t('studio.framing.percent', { percent: zoom.percent })}, ${fit}`}
          title={fit}
          onClick={zoom.toFit}
        >
          {t('studio.framing.percent', { percent: zoom.percent })}
        </button>
      )}
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-label={zoomIn}
        title={`${zoomIn}\n${hint}`}
        aria-disabled={!zoom.canZoomIn}
        onClick={() => {
          if (zoom.canZoomIn) {
            zoom.zoomIn();
          }
        }}
      >
        <Glyph name="zoom-in" />
      </button>
    </div>
  );
}
