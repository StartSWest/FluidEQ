/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef } from 'react';
import { subscribeWindowSide } from '../../utils/windowSide';

/**
 * One frame painted by the app's own painters into a figure's canvas.
 * `width` and `height` are the canvas's CSS pixels, the space every painter
 * here draws in; `ratio` is what one of them is on screen.
 */
export type THelpCanvasPaint = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  ratio: number,
) => void;

/**
 * A still canvas in a figure, painted whenever it is laid out again and
 * whenever the window turns white or dark (the painters read its colours).
 *
 * The figure is drawn under CSS `zoom`, so the canvas's CSS pixels and its
 * pixels on screen differ: the backing store is sized to what is on screen,
 * so an enlarged figure stays sharp, and the painter is handed the CSS size,
 * so its type and its notes keep their proportions at any zoom.
 */
const useHelpCanvas = (paint: THelpCanvasPaint) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const draw = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const shown = canvas.getBoundingClientRect().width / width;
      const ratio = Math.min(4, (window.devicePixelRatio || 1) * (shown || 1));
      const backingWidth = Math.round(width * ratio);
      const backingHeight = Math.round(height * ratio);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      const context = canvas.getContext('2d');
      if (context) {
        paintRef.current(context, width, height, ratio);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const stopWatchingSide = subscribeWindowSide(draw);
    return () => {
      observer.disconnect();
      stopWatchingSide();
    };
  }, []);
  return canvasRef;
};

export default useHelpCanvas;
