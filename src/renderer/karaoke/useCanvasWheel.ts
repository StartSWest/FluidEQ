/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type RefObject,
  useEffect,
  useRef,
  type WheelEvent as ReactWheelEvent,
} from 'react';

interface ICanvasWheelInput {
  onCanvasWheel: (event: ReactWheelEvent<HTMLCanvasElement>) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * The editor canvas's wheel, on a listener that may cancel it.
 *
 * Zooming needs a non-passive wheel listener, attached by hand. React
 * registers `wheel` as passive, so `preventDefault` inside an `onWheel` prop
 * is refused — Chromium logs "Unable to preventDefault inside passive event
 * listener invocation" on every notch of a Ctrl-scroll zoom, and the page
 * scrolls underneath the editor while it zooms. The only way to cancel a
 * wheel event is to register the listener yourself with `passive: false`.
 */
const useCanvasWheel = ({ onCanvasWheel, canvasRef }: ICanvasWheelInput) => {
  // Through a ref, because `onCanvasWheel` is rebuilt on every render. Listing
  // it as a dependency would detach and reattach the listener on every frame
  // of a zoom, which is both wasteful and a good way to drop the event that
  // arrives mid-swap. The ref keeps one listener for the life of the canvas
  // while always calling the current handler.
  const canvasWheelRef = useRef(onCanvasWheel);
  canvasWheelRef.current = onCanvasWheel;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) =>
      canvasWheelRef.current(
        event as unknown as ReactWheelEvent<HTMLCanvasElement>,
      );
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef]);
};

export default useCanvasWheel;
