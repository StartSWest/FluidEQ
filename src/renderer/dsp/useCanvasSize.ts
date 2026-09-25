/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type RefObject } from 'react';

export interface ICanvasSize {
  /** CSS pixels, whole, as `clientWidth` and `clientHeight` report them. */
  width: number;
  height: number;
}

/**
 * A canvas's box, kept by an observer instead of read inside the frame.
 *
 * The rack's time strips wrote their live figures and then read
 * `clientWidth`/`clientHeight` in the same frame. The text had just made the
 * layout dirty, so the read had the browser lay the window out there and
 * then, every frame the audio was playing, only to report a size that had
 * not changed. A box only changes when the page is laid out anyway, and the
 * observer is told exactly then; `onResize` asks for the frame that repaints
 * the drawing at the new size.
 *
 * Zero until the first report, which arrives before the first paint of an
 * element that has a box at all.
 */
const useCanvasSize = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onResize: () => void,
): RefObject<ICanvasSize> => {
  const sizeRef = useRef<ICanvasSize>({ width: 0, height: 0 });
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = Math.round(box.width);
      sizeRef.current.height = Math.round(box.height);
      onResizeRef.current();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);

  return sizeRef;
};

export default useCanvasSize;
