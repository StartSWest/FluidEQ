/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's sketch opened from the picture viewer (Ivan, 2026-11-09: "draw
 * also on zoomed pic inside the chat"): it opens at the closer look it is
 * handed and its button says what it does there; and it decodes nothing
 * whose header it cannot read, now that pictures Claude's looks and ChatGPT
 * brought in reach it. Each rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import StudioChatSketch from '../../../renderer/studio/chat/StudioChatSketch';
import { jpegHeader } from '../../utils/pictureHeaders';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const decoded = jest.fn();

beforeEach(() => {
  decoded.mockClear();
  Object.defineProperty(window, 'createImageBitmap', {
    configurable: true,
    value: async () => {
      decoded();
      return { width: 1600, height: 900, close: () => undefined };
    },
  });
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

it('opens at the closer look it is handed, and says what its button does', async () => {
  render(
    <StudioChatSketch
      image={jpegHeader(1600, 900)}
      openingView={{ scale: 2, x: 0, y: 0 }}
      doneLabel="attach it"
      onDone={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await act(async () => undefined);
  expect(percent()).toBe('studio.framing.percent 200');
  expect(screen.getByRole('button', { name: 'attach it' })).toBeEnabled();
});

it('control: with nothing handed it opens fitted, its button its own', async () => {
  render(
    <StudioChatSketch
      image={jpegHeader(1600, 900)}
      onDone={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await act(async () => undefined);
  expect(percent()).toBe('studio.framing.percent 50');
  expect(
    screen.getByRole('button', { name: 'studioChat.sketch.done' }),
  ).toBeInTheDocument();
});

it('decodes nothing whose header it cannot read, and closes', async () => {
  const onClose = jest.fn();
  render(
    <StudioChatSketch
      image={new Uint8Array([0xff, 0xd8, 0xff])}
      onDone={jest.fn()}
      onClose={onClose}
    />,
  );
  await act(async () => undefined);
  expect(decoded).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('control: a picture whose header it reads is decoded and stays open', async () => {
  const onClose = jest.fn();
  render(
    <StudioChatSketch
      image={jpegHeader(1600, 900)}
      onDone={jest.fn()}
      onClose={onClose}
    />,
  );
  await act(async () => undefined);
  expect(decoded).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});
