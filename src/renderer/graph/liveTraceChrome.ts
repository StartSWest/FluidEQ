/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type RefObject } from 'react';
import type { IChromeBox } from './invaderCabinet';

/**
 * The app's own chrome lying over the trace's canvas, in the canvas's
 * pixels: the titlebar and the transport bar where they overlap it, the
 * graph's controls strip, and in full screen the creature pinned in the
 * top-left corner. A scene that prints along the canvas's edge - the
 * arcade's score - moves clear of these rather than under them.
 *
 * Measured from the DOM rather than assumed, so a hidden bar counts as no
 * bar, and re-measured whenever the canvas or the strip changes size -
 * which is what entering and leaving full screen does to both. Only the
 * pieces that actually cover it count: a strip scrolled away or a creature
 * on a different display is no reason to push a readout down.
 */
const useLiveTraceChrome = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
): RefObject<readonly IChromeBox[]> => {
  const chromeRef = useRef<readonly IChromeBox[]>([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const wrapper = canvas.closest('.graph-wrapper');
    const strips = wrapper
      ? [...wrapper.querySelectorAll('.live-output-controls')]
      : [];
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      chromeRef.current = [
        // The strip's pieces, never the strip: it spans the whole plot for
        // the looks' gallery (`GraphGallery`), and only what is placed in it
        // covers anything.
        ...strips.flatMap((strip) => [...strip.children]),
        ...document.querySelectorAll(
          '.window-titlebar, .now-playing-bar, .fullscreen-chrome > *',
        ),
      ]
        .map((piece) => piece.getBoundingClientRect())
        .filter(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > box.top &&
            rect.top < box.bottom &&
            rect.right > box.left &&
            rect.left < box.right,
        )
        .map((rect) => ({
          left: rect.left - box.left,
          right: rect.right - box.left,
          top: rect.top - box.top,
          bottom: rect.bottom - box.top,
        }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    strips.forEach((strip) => {
      observer.observe(strip);
      // The credit grows as its switches open.
      [...strip.children].forEach((piece) => observer.observe(piece));
    });
    measure();
    return () => observer.disconnect();
  }, [canvasRef, width, height]);
  return chromeRef;
};

export default useLiveTraceChrome;
