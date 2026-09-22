/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memo } from 'react';

/** Which segments light for each character a clock can show. */
const LIT: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

// One digit's cell: 20 wide, 36 tall, segments 3.6 thick with a 0.7 gap.
const W = 20;
const H = 36;
const T = 3.6;
const G = 0.7;
const across = (from: number, to: number, y: number) =>
  `${from},${y} ${from + T / 2},${y - T / 2} ${to - T / 2},${y - T / 2} ${to},${y} ${to - T / 2},${y + T / 2} ${from + T / 2},${y + T / 2}`;
const down = (x: number, from: number, to: number) =>
  `${x},${from} ${x + T / 2},${from + T / 2} ${x + T / 2},${to - T / 2} ${x},${to} ${x - T / 2},${to - T / 2} ${x - T / 2},${from + T / 2}`;
const LEFT = T / 2;
const RIGHT = W - T / 2;
const TOP = T / 2;
const MIDDLE = H / 2;
const BOTTOM = H - T / 2;
const SEGMENTS: Record<string, string> = {
  a: across(LEFT + G, RIGHT - G, TOP),
  g: across(LEFT + G, RIGHT - G, MIDDLE),
  d: across(LEFT + G, RIGHT - G, BOTTOM),
  f: down(LEFT, TOP + G, MIDDLE - G),
  b: down(RIGHT, TOP + G, MIDDLE - G),
  e: down(LEFT, MIDDLE + G, BOTTOM - G),
  c: down(RIGHT, MIDDLE + G, BOTTOM - G),
};
// The sign is a minus and nothing else, so its unlit ghost is one bar.
const SIGN = { g: across(1.4, 12.6, MIDDLE) };
// Sign, two minute digits, colon, two second digits.
const DIGIT_X = [16, 42, 76, 102];
const COLON_X = 66;

/**
 * A seven-segment clock: minutes and seconds, with a minus for time left.
 *
 * Every segment is drawn, the unlit ones as a ghost, the way a real display
 * shows its eights — it is what makes the digits read as a display and not
 * as a font. Drawn rather than typeset for the same reason: no face the app
 * ships has these shapes, and bundling one for five characters is not a
 * trade worth making.
 *
 * `text` is five characters: the sign, then minutes and seconds with no
 * colon. Dashes where the source reports no position.
 */
const LedClock = ({ text }: { text: string }) => {
  const chars = [...text.padEnd(5, ' ')].slice(0, 5);
  const cell = (char: string, x: number, isSign: boolean) => {
    const lit = LIT[char] ?? '';
    const shapes = isSign ? SIGN : SEGMENTS;
    return (
      <g transform={`translate(${x} 0)`} key={x}>
        {Object.entries(shapes).map(([name, points]) => (
          <polygon
            key={name}
            points={points}
            className={lit.includes(name) ? 'is-lit' : 'is-ghost'}
          />
        ))}
      </g>
    );
  };
  return (
    <svg
      className="led-clock"
      viewBox={`-3 -2 ${102 + W + 7} ${H + 4}`}
      aria-hidden="true"
    >
      <g transform="skewX(-7) translate(4 0)">
        {cell(chars[0], 0, true)}
        {chars.slice(1).map((char, i) => cell(char, DIGIT_X[i], false))}
        <g transform={`translate(${COLON_X} 0)`}>
          <rect
            className="is-lit led-clock__colon"
            x="0.5"
            y="8.8"
            width="4.4"
            height="4.4"
            rx="1"
          />
          <rect
            className="is-lit led-clock__colon"
            x="0.5"
            y="22.8"
            width="4.4"
            height="4.4"
            rx="1"
          />
        </g>
      </g>
    </svg>
  );
};

/** The clock's five characters for a time, played or left. */
export const clockText = (seconds: number | undefined, isLeft: boolean) => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return ' ----';
  }
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.min(99, Math.floor(whole / 60));
  const rest = whole % 60;
  return `${isLeft ? '-' : ' '}${String(minutes).padStart(2, '0')}${String(rest).padStart(2, '0')}`;
};

export default memo(LedClock);
