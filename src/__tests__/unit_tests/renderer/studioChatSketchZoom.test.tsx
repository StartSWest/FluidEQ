/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The picture drawn on before it goes with a message zooms (Ivan,
 * 2026-11-07: "this windows needs to be bigger and be able to zoom the image
 * to see better"), the way the Studio's picture viewers do — and a word
 * typed on the picture keeps its keys: a hyphen in it zoomed out instead.
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

beforeEach(() => {
  Object.defineProperty(window, 'createImageBitmap', {
    configurable: true,
    value: async () => ({ width: 1600, height: 900, close: () => undefined }),
  });
  // The space is measured once before the first paint; nothing resizes here.
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })),
  });
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
});

afterEach(() => {
  jest.restoreAllMocks();
});

const percent = () =>
  document.querySelector('.studio-chat-sketch .studio-lightbox__percent')
    ?.textContent;

const opened = async () => {
  render(
    <StudioChatSketch
      // A JPEG whose header says its size: the sketch decodes nothing
      // whose header it cannot read (`decodePicture`).
      image={jpegHeader(1600, 900)}
      onDone={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await act(async () => undefined);
};

it('fits the picture, zooms in and out with its bar and keys, and fits again', async () => {
  await opened();
  expect(percent()).toBe('studio.framing.percent 50');
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  expect(percent()).toBe('studio.framing.percent 100');
  act(() => {
    fireEvent.keyDown(document, { key: '+' });
  });
  expect(percent()).toBe('studio.framing.percent 200');
  act(() => {
    fireEvent.keyDown(document, { key: '0' });
  });
  expect(percent()).toBe('studio.framing.percent 50');
});

it('lets a word typed on the picture keep its hyphen', async () => {
  await opened();
  fireEvent.click(
    screen.getByRole('button', { name: 'studio.picture.zoomIn' }),
  );
  expect(percent()).toBe('studio.framing.percent 100');
  fireEvent.click(
    screen.getByRole('radio', { name: 'studioChat.sketch.text' }),
  );
  fireEvent.click(screen.getByLabelText('studioChat.sketch.canvas'));
  const word = screen.getByRole('textbox', { name: 'studioChat.sketch.text' });
  act(() => {
    fireEvent.keyDown(word, { key: '-' });
  });
  // The positive control above: a key on the page zooms; in the word it does not.
  expect(percent()).toBe('studio.framing.percent 100');
});
