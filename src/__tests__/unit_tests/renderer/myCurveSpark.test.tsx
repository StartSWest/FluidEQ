/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import MyCurveSpark, { SPARK_BOX } from 'renderer/eq/MyCurveSpark';

/** The drawn line's heights, in the box's own units. */
const heightsOf = (text: string) => {
  const { container } = render(<MyCurveSpark text={text} />);
  const d = container.querySelector('.my-curve__line')?.getAttribute('d') ?? '';
  return [...d.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((match) =>
    Number(match[2]),
  );
};

const inside = (heights: number[]) =>
  heights.every((y) => y >= 0 && y <= SPARK_BOX.height);

it('keeps a correction with a deep preamp and a tall peak inside its box', () => {
  // The curve that ran out of the bottom of the row (Ivan, 2026-10-20).
  const heights = heightsOf(
    [
      'Preamp: -9.9 dB',
      'Filter 1: ON PK Fc 130 Hz Gain -6.3 dB Q 0.9',
      'Filter 2: ON PK Fc 2600 Hz Gain -6 dB Q 2.9',
      'Filter 3: ON PK Fc 4300 Hz Gain 10.6 dB Q 1.2',
      'Filter 4: ON PK Fc 7900 Hz Gain -6.4 dB Q 5',
    ].join('\n'),
  );
  expect(heights.length).toBeGreaterThan(10);
  expect(inside(heights)).toBe(true);
});

it('keeps a curve far past ±12 dB inside its box too', () => {
  expect(inside(heightsOf('Filter 1: ON LSC Fc 60 Hz Gain -26 dB Q 0.7'))).toBe(
    true,
  );
});

it('shows a gentle curve’s shape instead of a flat line', () => {
  const heights = heightsOf('Filter 1: ON PK Fc 1000 Hz Gain 2 dB Q 1');
  // Two decibels on the ±6 dB floor: a sixth of the drawing's height.
  const inner =
    SPARK_BOX.height - SPARK_BOX.padding.top - SPARK_BOX.padding.bottom;
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(
    inner / 7,
  );
});

it('draws the shape, not the level: a preamp moves nothing', () => {
  const band = 'Filter 1: ON PK Fc 1000 Hz Gain 3 dB Q 1';
  expect(heightsOf(`Preamp: -9 dB\n${band}`)).toEqual(heightsOf(band));
});

it('draws nothing for text that holds no curve', () => {
  const { container } = render(<MyCurveSpark text="hello" />);
  expect(container.querySelector('.my-curve__line')).toBeNull();
});
