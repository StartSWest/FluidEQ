import { useEffect, useState, type RefObject } from 'react';
import type { IStagePlate } from './studioStageScreen';

/**
 * The stage's measured size, and where its plate stands in it.
 *
 * The canvas takes the frame's measured size; the frame's shape comes from
 * the chosen size in CSS, so the layout — not this — decides what fits.
 *
 * The plate's edges are for a preview's window to keep clear of: the
 * player's moves left of the plate, the ultra-wide graph below it. They move
 * as the stage narrows and as the plate's words change length or wrap onto a
 * second row, and nothing else says when either happens.
 */
export default function useStageBox(
  frameRef: RefObject<HTMLDivElement | null>,
  barRef: RefObject<HTMLDivElement | null>,
) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [plate, setPlate] = useState<IStagePlate>();

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      setBox((previous) =>
        Math.round(previous.width) === Math.round(width) &&
        Math.round(previous.height) === Math.round(height)
          ? previous
          : { width, height },
      );
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  useEffect(() => {
    const frame = frameRef.current;
    const bar = barRef.current;
    if (!frame || !bar) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (bar.offsetWidth === 0) {
        setPlate(undefined);
        return;
      }
      const stage = frame.getBoundingClientRect();
      const edges = bar.getBoundingClientRect();
      const left = Math.round(edges.left - stage.left);
      const bottom = Math.round(edges.bottom - stage.top);
      setPlate((previous) =>
        previous?.left === left && previous.bottom === bottom
          ? previous
          : { left, bottom },
      );
    });
    observer.observe(frame);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [frameRef, barRef]);

  return { box, plate };
}
