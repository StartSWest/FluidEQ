/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { renderHook } from '@testing-library/react';
import useMeterLabelFit from 'renderer/useMeterLabelFit';

/**
 * The meter's LIVE OUTPUT label steps aside where it would run into the
 * Rainbow pill, measured where both stand, in any language (Ivan,
 * 2026-11-15: Spanish "SALIDA EN DIRECTO" ran under "COLORIDO").
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

const setUp = () => {
  const shell = document.createElement('div');
  const label = document.createElement('span');
  const pill = document.createElement('button');
  boxAt(label, 14, 140);
  renderHook(() =>
    useMeterLabelFit(
      { current: shell },
      { current: label },
      { current: pill },
      true,
    ),
  );
  return { label, pill };
};

it('hides a label that would come within 8px of the pill', () => {
  const { label, pill } = setUp();
  boxAt(pill, 158, 90);
  notify();
  expect(label.dataset.cramped).toBe('');
});

it('shows a label with room to spare (the control)', () => {
  const { label, pill } = setUp();
  boxAt(pill, 170, 90);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
});

it('measures again when the meter narrows, and gives the label back', () => {
  const { label, pill } = setUp();
  boxAt(pill, 150, 90);
  notify();
  expect(label.dataset.cramped).toBe('');
  boxAt(pill, 200, 90);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
});

it('leaves the label to the meter width rules where no pill is drawn', () => {
  const { label, pill } = setUp();
  boxAt(pill, 0, 0);
  notify();
  expect(label.dataset.cramped).toBeUndefined();
});

it('watches the meter, the label and the pill', () => {
  setUp();
  expect(observed).toHaveLength(3);
});
