/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { IHelpLiveFigure } from 'common/helpGuide';
import { useTranslation } from '../../utils/I18nContext';
import HelpLiveSurface, { type IHelpLiveMeasure } from './HelpLiveSurface';
import { helpLiveDrawing } from './helpLiveFigures';
import { rememberMeasure, rememberedMeasure } from './liveMeasures';

/**
 * As large as the lightbox lets it be: the panel is drawn, not a picture, so
 * enlarging it costs no sharpness. Up to this many times its own size — past
 * that a player's key is a poster, not a closer look.
 */
const MAX_ZOOM = 2.5;

/** The share of the window's height the panel may take under the title. */
const HEIGHT_SHARE = 0.82;

/**
 * A live figure in the lightbox: drawn again, bigger, rather than a capture
 * stretched. Sized to the room the lightbox gives it, as that room changes.
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
  const [room, setRoom] = useState<{ width: number; height: number }>();
  const [measure, setMeasure] = useState(() =>
    rememberedMeasure(figure.live, locale),
  );
  const onMeasure = useCallback(
    (next: IHelpLiveMeasure) => {
      rememberMeasure(figure.live, locale, next);
      setMeasure(next);
    },
    [figure.live, locale],
  );

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) {
      return undefined;
    }
    // Inside the box's padding: measured across it, the folded line came out
    // its padding wider than the lightbox and was cut at the right.
    const fit = () => {
      const style = getComputedStyle(element);
      setRoom({
        width:
          element.clientWidth -
          (parseFloat(style.paddingLeft) || 0) -
          (parseFloat(style.paddingRight) || 0),
        height: window.innerHeight * HEIGHT_SHARE,
      });
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Drawing = helpLiveDrawing(figure.live);
  const width = measure?.width ?? figure.width;
  const height = measure?.height ?? figure.height;
  const zoom =
    room && room.width > 0
      ? Math.min(MAX_ZOOM, room.width / width, room.height / height)
      : 1;
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
