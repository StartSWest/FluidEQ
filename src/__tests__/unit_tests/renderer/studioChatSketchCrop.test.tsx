/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The picture drawn on before it goes with a message crops, and moves with
 * Space held (Ivan, 2026-11-08: "I also need to zoom and crop attached chat
 * images", "same in image editor pan with space pressed"): a framed box
 * becomes the picture, Undo brings the whole one back, and a drag with Space
 * held over a zoomed picture moves it without drawing — each beside the same
 * gesture without it.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StudioChatSketch from '../../../renderer/studio/chat/StudioChatSketch';
import { jpegHeader } from '../../utils/pictureHeaders';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

/** jsdom 20 has no PointerEvent, and the sketch reads `clientX` from one. */
class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.assign(window, { PointerEvent: TestPointerEvent });
  }
});

beforeEach(() => {
  // A picture is its source's size: the picture handed in is 1600 by 900,
  // and a crop is the canvas it was cut onto.
  Object.defineProperty(window, 'createImageBitmap', {
    configurable: true,
    value: async (source: unknown) =>
      source instanceof HTMLCanvasElement
        ? { width: source.width, height: source.height, close: jest.fn() }
        : { width: 1600, height: 900, close: jest.fn() },
  });
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })),
  });
  Element.prototype.setPointerCapture = jest.fn();
  // The space the picture is fitted in: 800 by 450, so fitted is 50%.
  jest
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(function width(this: HTMLElement) {
      return this.classList.contains('studio-chat-sketch__stage') ? 800 : 0;
    });
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockImplementation(function height(this: HTMLElement) {
      return this.classList.contains('studio-chat-sketch__stage') ? 450 : 0;
    });
  // The picture on screen at the fitted size: half its own pixels.
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 450,
      width: 800,
      height: 450,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const opened = async (onClose = jest.fn()) => {
  render(
    <StudioChatSketch
      // A JPEG whose header says its size: the sketch decodes nothing
      // whose header it cannot read (`decodePicture`).
      image={jpegHeader(1600, 900)}
      onDone={jest.fn()}
      onClose={onClose}
    />,
  );
  await act(async () => undefined);
  return onClose;
};

const picture = () =>
  screen.getByLabelText('studioChat.sketch.canvas') as HTMLCanvasElement;

/** A drag on the picture, in screen pixels. */
const drag = (from: [number, number], to: [number, number]) => {
  const canvas = picture();
  fireEvent.pointerDown(canvas, {
    button: 0,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1] });
};

const undo = () =>
  screen.getByRole('button', { name: 'studioChat.sketch.undo' });

it('frames a box, keeps only it, and Undo brings the whole picture back', async () => {
  await opened();
  fireEvent.click(
    screen.getByRole('radio', { name: 'studioChat.sketch.crop' }),
  );
  const apply = screen.getByRole('button', {
    name: 'studioChat.sketch.cropApply',
  });
  expect(apply).toBeDisabled();
  // Screen (100, 50) to (500, 250) is the picture's (200, 100) to (1000, 500).
  drag([100, 50], [500, 250]);
  expect(document.querySelector('.studio-chat-crop__size')).toHaveTextContent(
    '800 × 400',
  );
  expect(apply).toBeEnabled();
  await act(async () => {
    fireEvent.click(apply);
  });
  expect(picture()).toHaveAttribute('width', '800');
  expect(picture()).toHaveAttribute('height', '400');
  expect(document.querySelector('.studio-chat-crop__box')).toBeNull();
  // Taken back like a mark.
  fireEvent.click(undo());
  expect(picture()).toHaveAttribute('width', '1600');
  expect(picture()).toHaveAttribute('height', '900');
});

it('frames nothing on a click, and Escape drops a box before it closes the dialog', async () => {
  const onClose = await opened();
  fireEvent.click(
    screen.getByRole('radio', { name: 'studioChat.sketch.crop' }),
  );
  drag([100, 50], [102, 51]);
  expect(document.querySelector('.studio-chat-crop__box')).toBeNull();
  drag([100, 50], [500, 250]);
  expect(document.querySelector('.studio-chat-crop__box')).not.toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.querySelector('.studio-chat-crop__box')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('moves a zoomed picture with Space held and draws nothing; without Space the drag draws', async () => {
  await opened();
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  const frame = () =>
    (document.querySelector('.studio-chat-sketch__frame') as HTMLElement).style
      .transform;
  const before = frame();
  act(() => {
    fireEvent.keyDown(document, { code: 'Space', key: ' ' });
  });
  drag([400, 200], [300, 150]);
  act(() => {
    fireEvent.keyUp(document, { code: 'Space', key: ' ' });
  });
  expect(frame()).not.toBe(before);
  expect(undo()).toBeDisabled();
  // The control: the same drag with Space let go is the pen's.
  drag([400, 200], [300, 150]);
  expect(undo()).toBeEnabled();
});
