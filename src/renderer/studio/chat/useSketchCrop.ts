import { useRef, useState, type PointerEvent } from 'react';
import {
  cropAfter,
  cropUsable,
  type ICropBox,
  type TCropGrip,
} from './sketchCrop';
import type { IPoint } from './sketchMarks';

interface ICropDrag {
  grip: TCropGrip;
  pointer: number;
  start: IPoint;
  from: ICropBox | undefined;
}

/**
 * The sketch's crop box and the drags that make it (`sketchCrop.ts`): a
 * press on the picture draws a new one, on the box moves it, on a corner
 * stretches it. A press that drew nothing worth keeping — a click — leaves
 * the box that was there.
 *
 * `pointAt` turns a pointer's place on screen into the picture's pixels.
 */
export default function useSketchCrop(
  size: { width: number; height: number } | undefined,
  pointAt: (clientX: number, clientY: number) => IPoint | undefined,
) {
  const [box, setBox] = useState<ICropBox>();
  const drag = useRef<ICropDrag | undefined>(undefined);

  const begin = (grip: TCropGrip, event: PointerEvent<HTMLElement>) => {
    const start = pointAt(event.clientX, event.clientY);
    if (event.button !== 0 || !size || !start) {
      return;
    }
    // A corner sits on the box, which sits on the picture: one press, one grip.
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer already gone cannot be captured: thrown, it reached the
      // window's own error handler and put the whole app into recovery.
    }
    drag.current = { grip, pointer: event.pointerId, start, from: box };
    if (grip === 'new') {
      setBox({ x: start.x, y: start.y, width: 0, height: 0 });
    }
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const held = drag.current;
    const at = pointAt(event.clientX, event.clientY);
    if (!held || held.pointer !== event.pointerId || !size || !at) {
      return;
    }
    setBox(cropAfter(held.grip, held.from, held.start, at, size));
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    const held = drag.current;
    if (!held || held.pointer !== event.pointerId) {
      return;
    }
    drag.current = undefined;
    setBox((now) => (cropUsable(now) ? now : held.from));
  };

  return {
    box,
    usable: cropUsable(box),
    begin,
    move,
    end,
    clear: () => {
      drag.current = undefined;
      setBox(undefined);
    },
  };
}

export type TSketchCrop = ReturnType<typeof useSketchCrop>;
