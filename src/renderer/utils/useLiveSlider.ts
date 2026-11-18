/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ILiveSlider<T = number> {
  /** What the slider shows: the pointer's value while it leads the setting. */
  shown: T;
  /** Hand every value the slider moves to here. */
  set: (next: T) => void;
  /** Apply the newest value now: the control has settled. */
  flush: () => void;
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
 *
 * `restFrames` is how many painted frames follow an apply before the next:
 * one for a slider, more for a control whose every value restyles the whole
 * window in colour (the Tint's colour picker, Ivan 2026-11-18: "it updates
 * the app very fast and gets slow; update less often so the user can move
 * the picker better, and when they stop, apply quickly"). Counted in frames
 * the window paints, never in milliseconds, so a slow machine is given more
 * time and a fast one less. `flush` applies the newest value at once, for a
 * control that says it has settled.
 */
const useLiveSlider = <T = number>(
  value: T,
  apply: (next: T) => void,
  restFrames = 1,
): ILiveSlider<T> => {
  const [draft, setDraft] = useState<{ value: T }>();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const waiting = useRef<{ value: T } | undefined>(undefined);
  const frame = useRef(0);
  const resting = useRef(0);

  const tick = useCallback(() => {
    frame.current = 0;
    // The frame after an apply is the thumb's: its restyle has painted, and
    // this one paints only what moved since.
    if (resting.current > 0) {
      resting.current -= 1;
      if (waiting.current !== undefined || resting.current > 0) {
        frame.current = requestAnimationFrame(tick);
      }
      return;
    }
    const next = waiting.current;
    if (next === undefined) {
      return;
    }
    waiting.current = undefined;
    applyRef.current(next.value);
    // Nothing newer behind it: the slider shows the setting itself again, in
    // the same render as the setting's own change, so it never shows the old
    // value between the two; and a setting that clamped or ignored the value
    // is what it shows, rather than a draft that nothing would ever clear.
    if (waiting.current === undefined) {
      setDraft(undefined);
    }
    resting.current = restFrames;
    frame.current = requestAnimationFrame(tick);
  }, [restFrames]);

  const set = useCallback(
    (next: T) => {
      setDraft({ value: next });
      waiting.current = { value: next };
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
        applyRef.current(waiting.current.value);
        waiting.current = undefined;
      }
    },
    [],
  );

  const flush = useCallback(() => {
    const next = waiting.current;
    if (next === undefined) {
      return;
    }
    waiting.current = undefined;
    applyRef.current(next.value);
    setDraft(undefined);
  }, []);

  return { shown: draft === undefined ? value : draft.value, set, flush };
};

export default useLiveSlider;
