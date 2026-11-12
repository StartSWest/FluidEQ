/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';

/**
 * The moment FluidEQ began: its repository was created at 15:02:14 UTC on
 * 2 August 2026 (GitHub's own record of the repository). The count on 2.5's
 * opening page runs from here, read from the clock each time, so it is never
 * a number frozen into the strings or the build.
 */
export const FLUIDEQ_BEGAN_AT = Date.parse('2026-08-02T15:02:14Z');

export interface ILiveFor {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Whole seconds since `since`, never below zero (a clock set back). */
const secondsSince = (now: number, since: number) =>
  Math.max(0, Math.floor((now - since) / 1000));

/** How long FluidEQ has been alive at `now`, in days down to seconds. */
export const liveFor = (
  now: number,
  since: number = FLUIDEQ_BEGAN_AT,
): ILiveFor => {
  const total = secondsSince(now, since);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
};

/**
 * The count, kept current while whatever shows it is mounted. It is a clock,
 * so it reads the clock: one animation frame after another while the page is
 * painted (a hidden window gets none, and the tour mounts only the slide on
 * screen), and the state moves only when the whole second changes, so React
 * renders once a second rather than once a frame. Reduced motion changes
 * nothing here: the value has to be right, and nothing on screen slides.
 */
export function useLiveFor(now: () => number = Date.now): ILiveFor {
  const [total, setTotal] = useState(() =>
    secondsSince(now(), FLUIDEQ_BEGAN_AT),
  );

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setTotal(secondsSince(now(), FLUIDEQ_BEGAN_AT));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [now]);

  return liveFor(FLUIDEQ_BEGAN_AT + total * 1000);
}
