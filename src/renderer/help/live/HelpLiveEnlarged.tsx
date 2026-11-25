/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { IHelpLiveFigure } from 'common/helpGuide';
import { useTranslation } from '../../utils/I18nContext';
import HelpLiveSurface, { type IHelpLiveMeasure } from './HelpLiveSurface';
import { helpLiveDrawing } from './helpLiveFigures';
import { type ILightboxRoom, lightboxRoom, lightboxZoom } from './lightboxRoom';
import { rememberMeasure, rememberedMeasure } from './liveMeasures';

const px = (value: string) => parseFloat(value) || 0;

/**
 * The room the lightbox gives the drawing, read from the lightbox's frame
 * alone (`lightboxRoom.ts` says why nothing drawn may decide it).
 */
const roomOf = (box: HTMLElement): ILightboxRoom | undefined => {
  const area = box.parentElement;
  const sheet = box.closest<HTMLElement>('.help-lightbox');
  const title = sheet?.querySelector<HTMLElement>('.help-lightbox__title');
  if (!area || !sheet || !title) {
    return undefined;
  }
  const own = getComputedStyle(box);
  const areaStyle = getComputedStyle(area);
  const sheetStyle = getComputedStyle(sheet);
  return lightboxRoom({
    areaWidth: area.offsetWidth,
    areaBordersX:
      px(areaStyle.borderLeftWidth) + px(areaStyle.borderRightWidth),
    maxHeight: px(sheetStyle.maxHeight),
    sheetBordersY:
      px(sheetStyle.borderTopWidth) + px(sheetStyle.borderBottomWidth),
    titleHeight: title.offsetHeight,
    seam: px(areaStyle.borderTopWidth),
    paddingX: px(own.paddingLeft) + px(own.paddingRight),
    paddingY: px(own.paddingTop) + px(own.paddingBottom),
  });
};

const sameRoom = (one: ILightboxRoom | undefined, other: ILightboxRoom) =>
  one?.width === other.width && one.height === other.height;

/**
 * A live figure in the lightbox: drawn again, bigger, rather than a capture
 * stretched. Sized to the room the lightbox gives it, as that room changes
 * with the window — and with nothing else.
 */
export default function HelpLiveEnlarged({
  figure,
  title,
}: {
  figure: IHelpLiveFigure;
  /** What it shows, as an enlarged capture's `alt` says it. */
  title: string;
}) {
  const { locale } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<ILightboxRoom>();
  /**
   * The size the fit is worked out from: the figure's size as it was last
   * measured when the lightbox opened, or its first measure here, and then
   * kept. Never the measure this lightbox's own zoom produces: CSS zoom lays
   * the drawing out at its drawn size, so its height in its own pixels moves
   * with the zoom (text wraps at a different place), and a figure whose zoom
   * came from its height chased that height — at 1280 x 578 the Room flipped
   * between two sizes every frame.
   */
  const [fitSize, setFitSize] = useState(() =>
    rememberedMeasure(figure.live, locale),
  );
  const onMeasure = useCallback(
    (next: IHelpLiveMeasure) => {
      rememberMeasure(figure.live, locale, next);
      setFitSize((kept) => kept ?? next);
    },
    [figure.live, locale],
  );

  useLayoutEffect(() => {
    const element = box.current;
    const area = element?.parentElement;
    if (!element || !area) {
      return undefined;
    }
    const fit = () => {
      const next = roomOf(element);
      if (next) {
        setRoom((last) => (sameRoom(last, next) ? last : next));
      }
    };
    fit();
    // The scroll area's width follows the window's and never the drawing's;
    // the height is the lightbox's `max-height`, a share of the window, which
    // only the window's own resize reports.
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  const Drawing = helpLiveDrawing(figure.live);
  const zoom = lightboxZoom(
    room,
    fitSize?.width ?? figure.width,
    fitSize?.height ?? figure.height,
  );
  return (
    <div
      className="help-lightbox__live"
      ref={box}
      role="img"
      aria-label={title}
    >
      {Drawing && (
        <HelpLiveSurface
          figure={figure}
          Drawing={Drawing}
          zoom={zoom}
          onMeasure={onMeasure}
        />
      )}
    </div>
  );
}
