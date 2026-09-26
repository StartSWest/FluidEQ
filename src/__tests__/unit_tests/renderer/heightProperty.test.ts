/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The band rail's height, measured onto the rail rather than quoted in
 * container units, which re-resolved on every step of a slider drag
 * (2026-09-26). jsdom lays nothing out and has no ResizeObserver, so the
 * observer is a stub that reports whatever height it is told.
 */

import heightProperty from '../../../renderer/utils/heightProperty';

type Report = (entries: Array<{ contentRect: { height: number } }>) => void;

let report: Report | undefined;
const disconnect = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: jest.fn((callback: Report) => {
      report = callback;
      return { observe: () => undefined, disconnect };
    }),
  });
});

afterEach(() => {
  report = undefined;
  disconnect.mockClear();
});

const measured = (element: HTMLElement) =>
  element.style.getPropertyValue('--rail-height');

describe('an element’s height as a property on it', () => {
  it('is written in whole pixels each time the element reports a new height', () => {
    const rail = document.createElement('div');
    heightProperty('--rail-height')(rail);
    // Positive control: nothing is written until the observer reports.
    expect(measured(rail)).toBe('');
    report?.([{ contentRect: { height: 209.6 } }]);
    expect(measured(rail)).toBe('210px');
    report?.([
      { contentRect: { height: 120 } },
      { contentRect: { height: 340.2 } },
    ]);
    expect(measured(rail)).toBe('340px');
  });

  it('stops watching when the element goes', () => {
    const detach = heightProperty('--rail-height')(
      document.createElement('div'),
    );
    detach?.();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a ref being cleared', () => {
    expect(heightProperty('--rail-height')(null)).toBeUndefined();
    expect(report).toBeUndefined();
  });
});
