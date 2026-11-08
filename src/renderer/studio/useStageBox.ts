import { useEffect, useState, type RefObject } from 'react';

/**
 * The stage's measured size, and where its plate's left edge stands in it.
 *
 * The canvas takes the frame's measured size; the frame's shape comes from
 * the chosen size in CSS, so the layout — not this — decides what fits.
 *
 * The plate's edge is for the player's window to keep clear of: it moves as
 * the stage narrows and as its reading's words change length, and nothing
 * else says when either happens.
 */
export default function useStageBox(
  frameRef: RefObject<HTMLDivElement | null>,
  barRef: RefObject<HTMLDivElement | null>,
) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [plateLeft, setPlateLeft] = useState<number>();

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
      setPlateLeft(
        bar.offsetWidth === 0
          ? undefined
          : Math.round(
              bar.getBoundingClientRect().left -
                frame.getBoundingClientRect().left,
            ),
      );
    });
    observer.observe(frame);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [frameRef, barRef]);

  return { box, plateLeft };
}
