/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../utils/bandReveal';

interface IKaraokeCountUpProps {
  value: number;
  /** Where it counts from when it first appears; `value` otherwise. */
  from?: number;
  durationMs?: number;
  format: (value: number) => string;
  /**
   * The widest text it will show, which sets its width: the figures are
   * tabular, so a number counting up never shoves what stands beside it.
   */
  widest: string;
  className?: string;
}

/**
 * A number that counts to each new value instead of jumping to it (Ivan,
 * 2026-11-16: "make sure the numbers don't glitch, they need to be smoother
 * changes"). An ease-out on the frame clock; a new value arriving mid-count
 * carries on from the figure on screen, so it never steps back.
 *
 * The text is written straight into the span each frame, not rendered: a
 * score counting for 600 ms would otherwise re-render its whole row sixty
 * times a second. The span has no React children for the same reason, so
 * React never holds a text node the frames have replaced.
 */
const KaraokeCountUp = ({
  value,
  from,
  durationMs = 600,
  format,
  widest,
  className,
}: IKaraokeCountUpProps) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(from ?? value);
  const countingRef = useRef(false);
  const formatRef = useRef(format);
  formatRef.current = format;

  // A new language, or a render while still: the figure in the new format.
  useLayoutEffect(() => {
    const span = spanRef.current;
    if (span && !countingRef.current) {
      span.textContent = format(shownRef.current);
    }
  });

  useEffect(() => {
    const span = spanRef.current;
    const start = shownRef.current;
    if (!span || start === value || prefersReducedMotion()) {
      shownRef.current = value;
      if (span) {
        span.textContent = formatRef.current(value);
      }
      return undefined;
    }
    let frame = 0;
    let beganAt: number | undefined;
    const step = (now: number) => {
      if (beganAt === undefined) {
        beganAt = now;
      }
      const progress = Math.min(1, (now - beganAt) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      shownRef.current = start + (value - start) * eased;
      span.textContent = formatRef.current(shownRef.current);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        countingRef.current = false;
      }
    };
    countingRef.current = true;
    frame = requestAnimationFrame(step);
    return () => {
      countingRef.current = false;
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span
      ref={spanRef}
      className={`karaoke-count${className ? ` ${className}` : ''}`}
      style={{ minWidth: `calc(${widest.length}ch + 0.25em)` }}
    />
  );
};

export default KaraokeCountUp;
