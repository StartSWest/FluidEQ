/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ILiveSlider {
  /** What the slider shows: the pointer's value while it leads the setting. */
  shown: number;
  /** Hand every value the slider moves to here. */
  set: (next: number) => void;
}

/**
 * A slider whose setting is heavy for the window, kept under the pointer.
 *
 * The window's Brightness and Transparency restyle the whole page with each
 * step: measured in the app, 25ms of the page's style recalculated and about
 * as much again of drawing, so a frame took 50ms and the thumb crept after
 * the pointer at a dozen frames a second, the value applied in the same
 * frame as every move (Ivan, 2026-09-27: "respond fast in ui and then the
 * changes are done imedly but not blocking the ui").
 *
 * So the thumb and its reading follow the pointer at once, from a draft held
 * here, and the setting follows them on the next frame with the newest value
 * only — and never in two frames running: after a frame that applied one,
 * the next paints the thumb alone. The window keeps up with every other
 * frame of the drag and the thumb moves in all of them. A value still
 * waiting when the slider goes away (its menu closed mid-drag) is applied
 * then, so the last one is never lost.
 */
const useLiveSlider = (
  value: number,
  apply: (next: number) => void,
): ILiveSlider => {
  const [draft, setDraft] = useState<number>();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const waiting = useRef<number | undefined>(undefined);
  const frame = useRef(0);
  const resting = useRef(false);

  const tick = useCallback(() => {
    frame.current = 0;
    // The frame after an apply is the thumb's: its restyle has painted, and
    // this one paints only what moved since.
    if (resting.current) {
      resting.current = false;
      if (waiting.current !== undefined) {
        frame.current = requestAnimationFrame(tick);
      }
      return;
    }
    const next = waiting.current;
    if (next === undefined) {
      return;
    }
    waiting.current = undefined;
    applyRef.current(next);
    // Nothing newer behind it: the slider shows the setting itself again, in
    // the same render as the setting's own change, so it never shows the old
    // value between the two; and a setting that clamped or ignored the value
    // is what it shows, rather than a draft that nothing would ever clear.
    if (waiting.current === undefined) {
      setDraft(undefined);
    }
    resting.current = true;
    frame.current = requestAnimationFrame(tick);
  }, []);

  const set = useCallback(
    (next: number) => {
      setDraft(next);
      waiting.current = next;
      if (frame.current === 0) {
        frame.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      if (waiting.current !== undefined) {
        applyRef.current(waiting.current);
        waiting.current = undefined;
      }
    },
    [],
  );

  return { shown: draft ?? value, set };
};

export default useLiveSlider;
