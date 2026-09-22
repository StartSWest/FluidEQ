/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * A line of display text that scrolls when it does not fit, and sits still
 * when it does.
 *
 * Scrolled by the compositor (a CSS animation over two copies of the text,
 * so the loop has no seam), paced by its length so a long title does not
 * race. Whether it fits is measured, and measured again when the box or the
 * text changes: a title that fits the player's wide window scrolls in its
 * narrow one.
 */
const Marquee = ({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isRunning, setIsRunning] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const line = textRef.current;
    if (!box || !line || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => setIsRunning(line.scrollWidth > box.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span
      ref={boxRef}
      className={`player-marquee${isRunning ? ' is-running' : ''} ${className}`}
      title={text}
      style={
        {
          '--marquee-seconds': `${Math.max(9, text.length * 0.34)}s`,
        } as CSSProperties
      }
    >
      <span className="player-marquee__track">
        <span ref={textRef} className="player-marquee__text">
          {text}
        </span>
        {isRunning && (
          <span className="player-marquee__text" aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </span>
  );
};

export default Marquee;
