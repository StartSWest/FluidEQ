/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Glyph from '../../community/Glyph';
import DialogClose from '../../components/DialogClose';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import useModalKeys from '../../utils/useModalKeys';
import { mostEnlarged } from '../StudioPictureLightbox';
import StudioPictureZoomBar from '../StudioPictureZoomBar';
import usePictureZoom from '../usePictureZoom';
import type { IChatPicture } from './chatPictureList';
import '../../styles/Gallery.scss';
import '../../styles/StudioPictureLightbox.scss';

/** Where each key goes from `index`. The ends wrap round, as the arrows do. */
const STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

interface ISize {
  width: number;
  height: number;
}

/**
 * A picture from the chat as large as the window allows (Ivan, 2026-10-16:
 * "click on image in the chat to zoom should open a modal to open them
 * bigger than in the chat"): the Pictures card's own viewer, its head, zoom
 * bar, pan and arrows, over every picture in the conversation, so the looks
 * Claude took and the pictures ChatGPT made can be stepped through side by
 * side. Esc, a click beside the picture and the close button all close it.
 */
export default function StudioChatPictureViewer({
  pictures,
  index,
  onStep,
  onClose,
}: {
  pictures: readonly IChatPicture[];
  index: number;
  onStep: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const placeRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: onClose });

  const count = pictures.length;
  const picture = pictures[Math.min(index, count - 1)];
  // A data URL's size is only known once it is decoded: the frame is placed
  // from it, so nothing is drawn until then.
  const [sizes, setSizes] = useState<Record<string, ISize>>({});
  const size = picture ? sizes[picture.key] : undefined;
  useEffect(() => {
    if (!picture || sizes[picture.key]) {
      return undefined;
    }
    let live = true;
    const image = new Image();
    image.src = picture.src;
    image
      .decode()
      .then(() => {
        if (live) {
          setSizes((known) => ({
            ...known,
            [picture.key]: {
              width: image.naturalWidth,
              height: image.naturalHeight,
            },
          }));
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [picture, sizes]);

  const zoom = usePictureZoom(
    placeRef,
    picture?.key ?? '',
    size?.width ?? 1,
    size?.height ?? 1,
    size ? mostEnlarged(size.width, size.height) : 1,
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
      // Modal: the graph behind it listens for the same arrows.
      event.stopPropagation();
      onStep(step(index, count));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, index, onStep]);

  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  if (!picture) {
    return null;
  }

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
        className="studio-lightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="studio-lightbox__head">
          <span className="dialog-frame__tile" aria-hidden="true">
            <MenuIcon name="image" />
          </span>
          <div className="studio-lightbox__heading" aria-live="polite">
            <h2 id={titleId} className="dialog-frame__title">
              {picture.name}
            </h2>
            {size && (
              <span className="studio-lightbox__size">
                {t('studio.picture.size', {
                  width: String(size.width),
                  height: String(size.height),
                })}
              </span>
            )}
            {count > 1 && (
              <span className="dialog-frame__badge">
                {t('studio.picture.position', {
                  index: String(index + 1),
                  count: String(count),
                })}
              </span>
            )}
          </div>
        </div>
        <DialogClose
          ref={closeRef}
          className="studio-lightbox__close"
          label={t('studio.picture.close')}
          onClose={onClose}
        />

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
            {size && zoom.frameStyle && (
              <div
                key={picture.key}
                className={frameClass}
                style={zoom.frameStyle}
              >
                <img
                  className="studio-lightbox__picture"
                  src={picture.src}
                  alt={picture.name}
                  draggable={false}
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
                <img
                  className="studio-chat-viewer__thumb"
                  src={each.src}
                  alt=""
                  draggable={false}
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
