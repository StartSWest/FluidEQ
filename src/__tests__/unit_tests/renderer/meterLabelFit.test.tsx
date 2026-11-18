/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { renderHook } from '@testing-library/react';
import useMeterLabelFit from 'renderer/useMeterLabelFit';

/**
 * The meter's LIVE OUTPUT label steps aside where its text would run into
 * the readouts at the right of the same strip, measured where both stand, in
 * any language (Ivan, 2026-11-15: Spanish "SALIDA EN DIRECTO" ran under the
 * Colourful pill). The pill went on 2026-11-18, when Colourful mode lost its
 * switch; the readouts are what the label runs into now, and with none of
 * them shown, the pane's own edge.
 */

const observed: Element[] = [];
let notify: () => void = () => undefined;
beforeAll(() => {
  // jsdom has no ResizeObserver; this one is told when to fire.
  window.ResizeObserver = jest.fn((callback: () => void) => {
    notify = callback;
    return {
      observe: (element: Element) => observed.push(element),
      disconnect: () => {
        observed.length = 0;
      },
      unobserve: () => undefined,
    };
  }) as unknown as typeof ResizeObserver;
});

const boxAt = (element: HTMLElement, left: number, width: number) => {
  element.getBoundingClientRect = () =>
    ({ left, right: left + width, width }) as DOMRect;
};

/**
 * A label at 14px whose text reaches 140px past it, whatever its box: the box
 * shrinks with the strip and the text runs on past it.
 */
const setUp = () => {
  const shell = document.createElement('div');
  const label = document.createElement('span');
  const readouts = document.createElement('span');
  boxAt(shell, 0, 400);
  boxAt(label, 14, 60);
  Object.defineProperty(label, 'scrollWidth', {
    configurable: true,
    value: 140,
  });
  renderHook(() =>
    useMeterLabelFit(
      { current: shell },
      { current: label },
      { current: readouts },
      true,
    ),
  );
  return { shell, label, readouts };
};

it('hides a label whose text would come within 8px of the readouts', () => {
  const { label, readouts } = setUp();
  boxAt(readouts, 158, 90);
  notify();
  expect(label.dataset.cramped).toBe('');
});

it('shows a label with room to spare (the control)', () => {
  const { label, readouts } = setUp();
  boxAt(readouts, 170, 90);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
});

it('measures the text, not the shrunken box', () => {
  const { label, readouts } = setUp();
  // The box ends at 74, far from the readouts; the text reaches 154.
  boxAt(readouts, 150, 90);
  notify();
  expect(label.dataset.cramped).toBe('');
});

it('measures again when the meter narrows, and gives the label back', () => {
  const { label, readouts } = setUp();
  boxAt(readouts, 150, 90);
  notify();
  expect(label.dataset.cramped).toBe('');
  boxAt(readouts, 200, 90);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
});

it('runs up to the pane’s own edge when no readout is shown', () => {
  const { shell, label, readouts } = setUp();
  boxAt(readouts, 0, 0);
  boxAt(shell, 0, 400);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
  // The control: a pane narrower than the text still hides it.
  boxAt(shell, 0, 150);
  notify();
  expect(label.dataset.cramped).toBe('');
});

it('watches the meter, the label and the readouts', () => {
  setUp();
  expect(observed).toHaveLength(3);
});
