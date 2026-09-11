import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  MAX_PICTURE_ZOOM,
  MIN_PICTURE_ZOOM,
  dragFraming,
  placePicture,
  zoomFraming,
  type IPictureFraming,
  type TPictureFit,
} from 'common/pictureFraming';
import type { TranslationKey } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import { drawFramed } from './scenePicture';
import type { IFramingSession } from './useScenePictures';
import '../styles/Gallery.scss';
import '../styles/StudioControls.scss';
import '../styles/StudioPictures.scss';
import '../styles/StudioStage.scss';

/**
 * The part of the photo beyond the place, on each side, as a fraction of the
 * place: enough of what is cut off to see what a drag would bring in.
 */
const MARGIN = 0.09;

/** One notch of a mouse wheel zooms this much. */
const WHEEL_ZOOM = 0.0015;

/** An arrow key moves the photo this much of the place; with Shift, more. */
const NUDGE = 0.02;
const NUDGE_FAR = 0.1;
const KEY_ZOOM = 1.1;

/** The place inside a stage `box` big, in the same units as `box`. */
const placeIn = (box: { width: number; height: number }) => ({
  x: (box.width * MARGIN) / (1 + 2 * MARGIN),
  y: (box.height * MARGIN) / (1 + 2 * MARGIN),
  width: box.width / (1 + 2 * MARGIN),
  height: box.height / (1 + 2 * MARGIN),
});

const FITS: readonly { fit: TPictureFit; key: TranslationKey }[] = [
  { fit: 'cover', key: 'studio.framing.cover' },
  { fit: 'contain', key: 'studio.framing.contain' },
];

interface IStudioFramingDialogProps {
  name: string;
  session: IFramingSession;
  saving: boolean;
  onSave: (framing: IPictureFraming) => void;
  onAnother: () => void;
  onCancel: () => void;
}

/**
 * Framing a photo into one of the scene's pictures: the photo in its place,
 * exactly as it will be saved, with what the place cuts off shown faintly
 * around it — dragged to move it, zoomed with the wheel or the slider,
 * filling the place or shown whole. It opens where the scene's `pack.json`
 * would have the photo sit, or where the member left it last time.
 *
 * Drawn by the same function the saved image is (`drawFramed`), at the
 * place's shape, so there is no second idea of where the photo goes.
 */
export default function StudioFramingDialog({
  name,
  session,
  saving,
  onSave,
  onAnother,
  onCancel,
}: IStudioFramingDialogProps) {
  const { t } = useTranslation();
  const zoomId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [framing, setFraming] = useState(session.framing);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | undefined>(undefined);
  const { picture, photo } = session;
  const photoSize = { width: photo.width, height: photo.height };
  const cancel = useCallback(() => onCancel(), [onCancel]);
  useModalKeys(surfaceRef, stageRef, { busy: saving, onCancel: cancel });

  // Another photo on the editor starts again from where the session says.
  useEffect(() => setFraming(session.framing), [session]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((previous) =>
        Math.round(previous.width) === Math.round(width) &&
        Math.round(previous.height) === Math.round(height)
          ? previous
          : { width, height },
      );
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  /**
   * The place inside the stage, in the stage's CSS pixels: what a drag is
   * measured against, so the photo moves exactly as far as the pointer does.
   */
  const place = placeIn(box);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width < 1 || box.height < 1) {
      return;
    }
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const frame = placeIn({ width: canvas.width, height: canvas.height });
    context.clearRect(0, 0, canvas.width, canvas.height);
    // What the place cuts off, faint, where it would be.
    const drawn = placePicture(
      { width: photo.width, height: photo.height },
      frame,
      framing,
    );
    context.globalAlpha = 0.28;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      photo,
      frame.x + drawn.x,
      frame.y + drawn.y,
      drawn.width,
      drawn.height,
    );
    context.globalAlpha = 1;
    drawFramed(context, photo, frame, framing);
    // Exactly what the scene gets, on the scene's own dark where it is clear.
    context.save();
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#000';
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
    context.restore();
  }, [framing, box, photo]);

  const zoomTo = (zoom: number) =>
    setFraming((current) => zoomFraming(photoSize, place, current, zoom));

  // A wheel listener of our own: React's is passive, and a wheel over the
  // photo must zoom it rather than scroll the dialog.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFraming((current) =>
        zoomFraming(
          { width: photo.width, height: photo.height },
          placeIn({ width: stage.clientWidth, height: stage.clientHeight }),
          current,
          current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM),
        ),
      );
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [photo]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (saving) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from) {
      return;
    }
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setFraming((current) => dragFraming(photoSize, place, current, dx, dy));
  };

  const endDrag = () => {
    drag.current = undefined;
    setDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = (event.shiftKey ? NUDGE_FAR : NUDGE) * place.width;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFraming((current) =>
        dragFraming(photoSize, place, current, move[0], move[1]),
      );
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(framing.zoom * KEY_ZOOM);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(framing.zoom / KEY_ZOOM);
    }
  };

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          cancel();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="gallery-dialog studio-framing"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-framing-title"
        aria-busy={saving}
      >
        <div className="gallery-dialog__head">
          <span className="gallery-dialog__mark" aria-hidden="true">
            <Glyph name="camera" />
          </span>
          <span className="studio-framing__heading">
            <h2 id="studio-framing-title" className="gallery-dialog__title">
              {t('studio.framing.title', { name })}
            </h2>
            <span className="studio-framing__size">
              {t('studio.picture.size', {
                width: picture.width,
                height: picture.height,
              })}
            </span>
          </span>
        </div>

        {/* A photo moved by the pointer and by the arrow keys has no ARIA
            widget of its own; `application` tells assistive technology the
            keys belong to this surface, and the label says which do what. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see above */}
        <div
          ref={stageRef}
          className={`studio-framing__stage${dragging ? ' is-dragging' : ''}`}
          style={
            {
              '--aspect': picture.width / picture.height,
            } as CSSProperties
          }
          role="application"
          aria-label={t('studio.framing.stage', { name })}
          aria-roledescription={t('studio.framing.role')}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the arrow keys move the photo, so it must take focus
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <canvas ref={canvasRef} className="studio-framing__canvas" />
          <span
            className="studio-framing__frame"
            aria-hidden="true"
            style={{
              left: place.x,
              top: place.y,
              width: place.width,
              height: place.height,
            }}
          />
        </div>

        <span className="studio-framing__hint">{t('studio.framing.hint')}</span>

        <div className="studio-framing__controls">
          <div
            className="studio-segments"
            role="group"
            aria-label={t('studio.framing.fit')}
          >
            {FITS.map((entry) => (
              <button
                key={entry.fit}
                type="button"
                className="studio-segment"
                aria-pressed={framing.fit === entry.fit}
                disabled={saving}
                onClick={() =>
                  setFraming((current) =>
                    zoomFraming(
                      photoSize,
                      place,
                      { ...current, fit: entry.fit },
                      MIN_PICTURE_ZOOM,
                    ),
                  )
                }
              >
                {t(entry.key)}
              </button>
            ))}
          </div>
          <div className="studio-framing__zoom">
            <label htmlFor={zoomId}>{t('studio.framing.zoom')}</label>
            <input
              id={zoomId}
              type="range"
              className="studio-slider"
              min={MIN_PICTURE_ZOOM}
              max={MAX_PICTURE_ZOOM}
              step={0.01}
              value={framing.zoom}
              disabled={saving}
              style={
                {
                  '--fill': `${((framing.zoom - MIN_PICTURE_ZOOM) / (MAX_PICTURE_ZOOM - MIN_PICTURE_ZOOM)) * 100}%`,
                } as CSSProperties
              }
              onChange={(event) => zoomTo(Number(event.target.value))}
            />
            <span className="studio-framing__percent">
              {t('studio.framing.percent', {
                percent: Math.round(framing.zoom * 100),
              })}
            </span>
          </div>
          <button
            type="button"
            className="button small subtle"
            disabled={saving}
            onClick={() => setFraming(picture.framing)}
          >
            {t('studio.framing.reset')}
          </button>
        </div>

        <div className="gallery-dialog__foot">
          <button
            type="button"
            className="button small subtle gallery-dialog__aside"
            disabled={saving}
            onClick={onAnother}
          >
            <Glyph name="folder" />
            {t('studio.framing.another')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={saving}
            onClick={cancel}
          >
            {t('studio.framing.cancel')}
          </button>
          <button
            type="button"
            className={`button small${saving ? ' is-running' : ''}`}
            aria-busy={saving}
            onClick={() => {
              if (!saving) {
                onSave(framing);
              }
            }}
          >
            {saving ? t('studio.framing.saving') : t('studio.framing.use')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
