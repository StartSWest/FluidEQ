/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat's picture viewer and Draw (Ivan, 2026-11-09: "draw also on zoomed
 * pic inside the chat"): the button stands beside Copy image only where the
 * viewer has a chat to attach to, and hands over the picture shown with the
 * closer look the viewer is on; the viewer opens at a closer look it is
 * handed, which is how it comes back from a drawing left unattached.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IChatPicture } from '../../../renderer/studio/chat/chatPictureList';
import StudioChatPictureViewer from '../../../renderer/studio/chat/StudioChatPictureViewer';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const pictures: IChatPicture[] = [
  {
    key: 'a',
    name: 'Looked at the scene',
    src: 'data:image/jpeg;base64,/9j/',
    cutOut: false,
  },
];

beforeEach(() => {
  // The picture decodes to 320 by 180; the viewer's space is 800 by 450.
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(320);
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get')
    .mockReturnValue(180);
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })),
  });
  jest
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(function width(this: HTMLElement) {
      return this.classList.contains('studio-lightbox__place') ? 800 : 0;
    });
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockImplementation(function height(this: HTMLElement) {
      return this.classList.contains('studio-lightbox__place') ? 450 : 0;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const percent = () =>
  document.querySelector('.studio-lightbox .studio-lightbox__percent')
    ?.textContent;

const viewer = (
  props: Partial<Parameters<typeof StudioChatPictureViewer>[0]> = {},
) => (
  <StudioChatPictureViewer
    pictures={pictures}
    index={0}
    onStep={jest.fn()}
    onClose={jest.fn()}
    // eslint-disable-next-line react/jsx-props-no-spreading -- the case's own props over the defaults
    {...props}
  />
);

it('offers Draw beside Copy image where there is a chat to attach to', async () => {
  render(viewer({ onDraw: jest.fn() }));
  await act(async () => undefined);
  expect(
    screen.getByRole('button', { name: 'studioChat.viewer.draw' }),
  ).toBeInTheDocument();
});

it('control: offers no Draw where there is none, the forum’s viewer', async () => {
  render(viewer());
  await act(async () => undefined);
  expect(
    screen.queryByRole('button', { name: 'studioChat.viewer.draw' }),
  ).toBeNull();
});

it('hands over the picture shown and the closer look the viewer is on', async () => {
  const onDraw = jest.fn();
  render(viewer({ onDraw }));
  await act(async () => undefined);
  // Fitted, there is no closer look to hand over.
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.viewer.draw' }),
  );
  expect(onDraw).toHaveBeenLastCalledWith(pictures[0], undefined);
  // Closer: + takes it from fitted (150%, the most a small picture is
  // enlarged) to the next step, 200%.
  act(() => {
    fireEvent.keyDown(document, { key: '+' });
  });
  expect(percent()).toBe('studio.framing.percent 200');
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.viewer.draw' }),
  );
  const [, handed] = onDraw.mock.calls[onDraw.mock.calls.length - 1];
  expect(handed).toEqual(expect.objectContaining({ scale: 2 }));
});

it('opens at a closer look it is handed', async () => {
  render(viewer({ onDraw: jest.fn(), opening: { scale: 8, x: 0, y: 0 } }));
  await act(async () => undefined);
  expect(percent()).toBe('studio.framing.percent 800');
});

it('control: handed none, it opens fitted', async () => {
  render(viewer({ onDraw: jest.fn() }));
  await act(async () => undefined);
  expect(percent()).toBe('studio.framing.percent 150');
});
