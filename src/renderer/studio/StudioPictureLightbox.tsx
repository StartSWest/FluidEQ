import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';
import type { TPictureCopyOutcome } from 'main/ipc/studioPictureCopy';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import AtlasPicture, { uprightSize } from './AtlasPicture';
import StudioPictureZoomBar from './StudioPictureZoomBar';
import usePictureZoom from './usePictureZoom';
import '../styles/DialogHeader.scss';
import '../styles/Gallery.scss';
import '../styles/StudioPictureLightbox.scss';

/** One picture the viewer can show: a piece of the scene's image, or all of it. */
export interface IViewedPicture {
  /** What `busy` holds while this one is saved; unique in its set. */
  key: string;
  name: string;
  region: IArtworkRegion;
  /** The whole image, which is saved as it is rather than cut out again. */
  whole: boolean;
}

/**
 * A picture smaller than this on its longer side may be drawn past its own
 * pixels when fitted, up to this size. At its own size a 224 px bird is a
 * stamp in the middle of the window; at 448 px it is a picture.
 */
const SMALL_EDGE = 480;

/** And never past twice its own size, where the pixels start to show. */
const MOST_ENLARGED = 2;

/** How far past its own size a fitted picture may be drawn, as a factor. */
export const mostEnlarged = (width: number, height: number) => {
  const longer = Math.max(width, height);
  return longer >= SMALL_EDGE
    ? 1
    : Math.min(MOST_ENLARGED, SMALL_EDGE / longer);
};

/** Where each key goes from `index`. The ends wrap round, as the arrows do. */
const STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

interface IStudioPictureLightboxProps {
  /** The scene's whole image, as an object URL. */
  url: string;
  atlasWidth: number;
  atlasHeight: number;
  /** The set being stepped through, in the card's order. */
  pictures: IViewedPicture[];
  index: number;
  /** The save running now, if any. */
  busy: string | undefined;
  notice: TPictureCopyOutcome | undefined;
  onStep: (index: number) => void;
  onSave: (picture: IViewedPicture) => void;
  onClose: () => void;
}

/**
 * One of the scene's pictures as large as the window allows, over the app:
 * its name and size, the pieces beside it a key or a click away, zoom down
 * to its pixels, and the same Save the card has.
 *
 * The same size whatever it shows, so stepping from a wide strip to a tall
 * piece never moves the arrows, the zoom bar or the close button out from
 * under the pointer. A picture opens fitted, never blown up past its own
 * pixels except a small one (see `mostEnlarged`), and every step to another
 * picture opens that one fitted too.
 *
 * Esc, a click anywhere that is not the picture or a control, and the close
 * button all close it, and focus goes back to the tile that opened it. A
 * zoomed picture is being worked on, so a click beside it does not close.
 */
export default function StudioPictureLightbox({
  url,
  atlasWidth,
  atlasHeight,
  pictures,
  index,
  busy,
  notice,
  onStep,
  onSave,
  onClose,
}: IStudioPictureLightboxProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<HTMLDivElement>(null);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: onClose });

  const count = pictures.length;
  const picture = pictures[index];
  const upright = uprightSize(picture.region);
  const saving = busy === picture.key;
  const zoom = usePictureZoom(
    placeRef,
    picture.key,
    upright.width,
    upright.height,
    mostEnlarged(upright.width, upright.height),
  );

  useEffect(() => {
    if (count < 2) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const step = STEPS[event.key];
      if (
        !step ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }
      event.preventDefault();
      // The viewer is modal: the graph and the gallery behind it listen for
      // the same arrows on the window, and must not step as well.
      event.stopPropagation();
      onStep(step(index, count));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, index, onStep]);

  // The strip follows the arrows, so the lit thumbnail is never scrolled off.
  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  const closeOnEmpty = (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const placeClass = [
    'studio-lightbox__place',
    zoom.zoomed ? 'is-zoomed' : '',
    zoom.pannable ? 'is-pannable' : '',
    zoom.dragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const frameClass = [
    'studio-lightbox__frame',
    zoom.eased ? 'is-eased' : '',
    zoom.crisp ? 'is-crisp' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={closeOnEmpty}
    >
      <div
        ref={surfaceRef}
        className="gallery-dialog studio-lightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="gallery-dialog__head studio-lightbox__head">
          <span className="gallery-dialog__mark" aria-hidden="true">
            <Glyph name="image" />
          </span>
          {/* Read out again on every step, since the dialog stays open. */}
          <div className="studio-lightbox__heading" aria-live="polite">
            <h2 id={titleId} className="gallery-dialog__title">
              {picture.name}
            </h2>
            <span className="studio-lightbox__size">
              {t('studio.picture.size', upright)}
            </span>
            {count > 1 && (
              <span className="studio-lightbox__count">
                {t('studio.picture.position', { index: index + 1, count })}
              </span>
            )}
          </div>
          <div className="studio-lightbox__actions">
            {notice && notice !== 'cancelled' && (
              <span className="studio-lightbox__notice" role="status">
                {t(
                  notice === 'saved'
                    ? 'studio.picture.downloaded'
                    : 'studio.picture.downloadFailed',
                )}
              </span>
            )}
            <button
              type="button"
              className={`button small subtle${saving ? ' is-running' : ''}`}
              aria-busy={saving}
              disabled={busy !== undefined && !saving}
              onClick={() => {
                if (!busy) {
                  onSave(picture);
                }
              }}
            >
              <Glyph name="download" />
              {t('studio.picture.download')}
            </button>
            <button
              ref={closeRef}
              type="button"
              className="dialog-header__close"
              aria-label={t('studio.picture.close')}
              onClick={onClose}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="studio-lightbox__stage"
          role="presentation"
          onClick={closeOnEmpty}
        >
          {count > 1 && (
            <button
              type="button"
              className="studio-lightbox__step studio-lightbox__step--previous"
              aria-label={t('studio.picture.previous')}
              onClick={() => onStep(STEPS.ArrowLeft(index, count))}
            >
              <Glyph name="previous" />
            </button>
          )}
          {/* Dragged to pan and double-clicked to zoom; the same is on the
              zoom bar and on + − 0, so nothing here is pointer-only. */}
          <div
            ref={placeRef}
            className={placeClass}
            role="presentation"
            onClick={zoom.zoomed ? undefined : closeOnEmpty}
            onPointerDown={zoom.handlers.onPointerDown}
            onPointerMove={zoom.handlers.onPointerMove}
            onPointerUp={zoom.handlers.onPointerUp}
            onPointerCancel={zoom.handlers.onPointerCancel}
            onLostPointerCapture={zoom.handlers.onLostPointerCapture}
            onDoubleClick={zoom.handlers.onDoubleClick}
          >
            {zoom.frameStyle && (
              <div
                key={picture.key}
                className={frameClass}
                style={zoom.frameStyle}
              >
                <AtlasPicture
                  className="studio-lightbox__picture"
                  url={url}
                  atlasWidth={atlasWidth}
                  atlasHeight={atlasHeight}
                  region={picture.region}
                  label={picture.name}
                />
              </div>
            )}
          </div>
          {count > 1 && (
            <button
              type="button"
              className="studio-lightbox__step studio-lightbox__step--next"
              aria-label={t('studio.picture.next')}
              onClick={() => onStep(STEPS.ArrowRight(index, count))}
            >
              <Glyph name="next" />
            </button>
          )}
          <StudioPictureZoomBar
            percent={zoom.percent}
            fitted={!zoom.zoomed}
            canZoomIn={zoom.canZoomIn}
            canZoomOut={zoom.canZoomOut}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onFit={zoom.toFit}
          />
        </div>

        {count > 1 && (
          // Out of the Tab order: the arrow keys already walk the set, and
          // twenty-eight stops between Save and the close button would bury
          // both. A pointer's shortcut, and still buttons to a screen reader.
          <div
            ref={stripRef}
            className="studio-lightbox__strip"
            role="group"
            aria-label={t('studio.picture.all')}
          >
            {pictures.map((each, at) => (
              <button
                key={each.key}
                type="button"
                className="studio-lightbox__thumb"
                tabIndex={-1}
                aria-label={each.name}
                aria-current={at === index}
                onClick={() => onStep(at)}
              >
                <AtlasPicture
                  className="studio-lightbox__thumb-art"
                  url={url}
                  atlasWidth={atlasWidth}
                  atlasHeight={atlasHeight}
                  region={each.region}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
