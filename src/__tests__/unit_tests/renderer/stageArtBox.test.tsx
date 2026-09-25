/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The box a picture behind the graph stands in is written on the elements
 * that read it (`useStageArtFrame.ts`): the column, for the card and a video
 * inside it, and the picture itself, portalled beside `#root`. It was written
 * on the document, and a custom property there is inherited by every element
 * in the window — each write restyled all of it, on every frame of a window
 * or a pane being resized.
 */

import { renderHook } from '@testing-library/react';
import useStageArtFrame from '../../../renderer/library/useStageArtFrame';

interface IBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Layout's numbers for an element, which jsdom does not compute. */
const place = (element: HTMLElement, box: IBox) => {
  Object.defineProperties(element, {
    offsetTop: { configurable: true, value: box.top },
    offsetLeft: { configurable: true, value: box.left },
    offsetWidth: { configurable: true, value: box.width },
    offsetHeight: { configurable: true, value: box.height },
  });
};

const picture = () => {
  const element = document.createElement('div');
  element.className = 'library-stage-art';
  document.body.appendChild(element);
  return element;
};

const boxOf = (element: HTMLElement) =>
  [
    '--stage-art-left',
    '--stage-art-width',
    '--stage-art-top',
    '--stage-art-height',
  ].map((name) => element.style.getPropertyValue(name));

let column: HTMLElement;

beforeEach(() => {
  column = document.createElement('div');
  column.className = 'center-workspace';
  document.body.appendChild(column);
  // The expanded Library: the middle column, as tall as its list, in a
  // 768px window — so the box is clamped to what is on screen.
  place(column, { top: 40, left: 240, width: 900, height: 2618 });
});

afterEach(() => {
  document.body.replaceChildren();
});

it('writes the box on the column and the picture, never on the document', () => {
  const shown = picture();
  renderHook(() => useStageArtFrame());

  expect(boxOf(shown)).toEqual(['240px', '900px', '40px', '728px']);
  expect(column.style.getPropertyValue('--stage-art-shift')).toBe('0px');
  expect(column.style.getPropertyValue('--stage-art-height')).toBe('728px');
  // The null beside the two positives above: the same numbers, nowhere that
  // every element in the window inherits from.
  const { style } = document.documentElement;
  expect(style.getPropertyValue('--stage-art-left')).toBe('');
  expect(style.getPropertyValue('--stage-art-height')).toBe('');
  expect(style.getPropertyValue('--stage-art-shift')).toBe('');
});

it('gives a picture put up later the box as it is inserted', async () => {
  renderHook(() => useStageArtFrame());
  const late = picture();
  // Delivered as a microtask, after the insertion and before any paint.
  await Promise.resolve();
  expect(boxOf(late)).toEqual(['240px', '900px', '40px', '728px']);
});

it('rewrites the column only when the column’s own numbers change', () => {
  const shown = picture();
  renderHook(() => useStageArtFrame());
  const columnWrites = jest.spyOn(column.style, 'setProperty');

  // A side pane opening: the left edge and the width move, which only the
  // picture reads.
  place(column, { top: 40, left: 320, width: 820, height: 2618 });
  window.dispatchEvent(new Event('resize'));
  expect(boxOf(shown)).toEqual(['320px', '820px', '40px', '728px']);
  expect(columnWrites).not.toHaveBeenCalled();

  // The control: the column's own numbers moving do reach it.
  place(column, { top: 60, left: 320, width: 820, height: 2618 });
  window.dispatchEvent(new Event('resize'));
  expect(columnWrites).toHaveBeenCalledWith('--stage-art-height', '708px');
});

it('takes the column’s numbers away with it', () => {
  picture();
  const hook = renderHook(() => useStageArtFrame());
  hook.unmount();
  expect(column.style.getPropertyValue('--stage-art-shift')).toBe('');
  expect(column.style.getPropertyValue('--stage-art-height')).toBe('');
});
