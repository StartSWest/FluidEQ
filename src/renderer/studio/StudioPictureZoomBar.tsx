import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

interface IStudioPictureZoomBarProps {
  /** The picture's scale now, as a whole percentage of its own size. */
  percent: number;
  fitted: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

/**
 * The picture viewer's zoom, where it can be seen: out, how close it is now,
 * in, and back to the whole picture.
 *
 * A control with nowhere further to go says so with `aria-disabled` rather
 * than `disabled`: pressing − down to the end with the keyboard would
 * otherwise drop focus out of the dialog on the press that reaches it.
 */
export default function StudioPictureZoomBar({
  percent,
  fitted,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onFit,
}: IStudioPictureZoomBarProps) {
  const { t } = useTranslation();
  const zoomOut = t('studio.picture.zoomOut');
  const zoomIn = t('studio.picture.zoomIn');
  return (
    <div
      className="studio-lightbox__zoom"
      role="group"
      aria-label={t('studio.framing.zoom')}
    >
      <button
        type="button"
        className="button small subtle studio-lightbox__zoom-step"
        aria-label={zoomOut}
        title={zoomOut}
        aria-disabled={!canZoomOut}
        onClick={() => {
          if (canZoomOut) {
            onZoomOut();
          }
        }}
      >
        <Glyph name="zoom-out" />
      </button>
      <span className="studio-lightbox__percent">
        {t('studio.framing.percent', { percent })}
      </span>
      <button
        type="button"
        className="button small subtle studio-lightbox__zoom-step"
        aria-label={zoomIn}
        title={zoomIn}
        aria-disabled={!canZoomIn}
        onClick={() => {
          if (canZoomIn) {
            onZoomIn();
          }
        }}
      >
        <Glyph name="zoom-in" />
      </button>
      <button
        type="button"
        className="button small subtle studio-lightbox__fit"
        aria-disabled={fitted}
        onClick={() => {
          if (!fitted) {
            onFit();
          }
        }}
      >
        <Glyph name="fit" />
        {t('studio.picture.fit')}
      </button>
    </div>
  );
}
