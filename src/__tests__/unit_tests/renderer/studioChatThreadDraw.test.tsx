/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chat thread's picture viewer and its Draw (Ivan, 2026-11-09: "I should
 * be able to draw also on zoomed pic inside the chat and attach them to the
 * chat"): Draw is offered where there is a chat to attach to; the drawing
 * takes the viewer's place, from its closer look; leaving it brings the
 * viewer back at that closer look; attaching hands the picture to the chat
 * and closes both. Each rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioChat } from '../../../common/studioChat';
import type { IZoomView } from '../../../renderer/studio/pictureZoom';
import type { IChatPicture } from '../../../renderer/studio/chat/chatPictureList';
import StudioChatThread from '../../../renderer/studio/chat/StudioChatThread';

const mockViewerProps: Array<Record<string, unknown>> = [];
const mockDrawProps: Array<Record<string, unknown>> = [];

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/studio/chat/StudioChatPictureViewer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockViewerProps.push(props);
    return <div data-testid="viewer" />;
  },
}));
jest.mock('../../../renderer/studio/chat/StudioChatPictureDraw', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDrawProps.push(props);
    return <div data-testid="draw" />;
  },
}));

const SRC = 'data:image/jpeg;base64,/9j/';

beforeEach(() => {
  mockViewerProps.length = 0;
  mockDrawProps.length = 0;
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
});

const chat: IStudioChat = {
  projectId: 'lake',
  busy: false,
  entries: [{ kind: 'me', id: 'm', text: 'this one', picture: SRC }],
};

const thread = (onAttachPicture?: (image: Uint8Array) => void) => (
  <StudioChatThread
    chat={chat}
    onIdea={() => undefined}
    onCarryOn={() => undefined}
    onRetry={() => undefined}
    onRestore={() => Promise.resolve({ ok: true })}
    onAttachPicture={onAttachPicture}
  />
);
const lastViewer = () => mockViewerProps[mockViewerProps.length - 1];
const lastDraw = () => mockDrawProps[mockDrawProps.length - 1];
const openViewer = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.seenLarger' }),
  );
const shown: IChatPicture = { key: 'k', name: 'n', src: SRC, cutOut: false };
const view: IZoomView = { scale: 3.32, x: -40, y: 12 };
const draw = (from: IZoomView | undefined) =>
  act(() => {
    (lastViewer().onDraw as (p: IChatPicture, v?: IZoomView) => void)(
      shown,
      from,
    );
  });

it('offers Draw where there is a chat to attach to', () => {
  render(thread(jest.fn()));
  openViewer();
  expect(typeof lastViewer().onDraw).toBe('function');
});

it('control: offers no Draw where there is none', () => {
  render(thread());
  openViewer();
  expect(screen.getByTestId('viewer')).toBeInTheDocument();
  expect(lastViewer().onDraw).toBeUndefined();
});

it('draws in the viewer’s place, from its closer look', () => {
  render(thread(jest.fn()));
  openViewer();
  draw(view);
  expect(screen.queryByTestId('viewer')).toBeNull();
  expect(screen.getByTestId('draw')).toBeInTheDocument();
  expect(lastDraw().picture).toBe(shown);
  expect(lastDraw().openingView).toBe(view);
});

it('brings the viewer back at that closer look when the drawing is left', () => {
  render(thread(jest.fn()));
  openViewer();
  // Opened plain: no closer look to come back to yet.
  expect(lastViewer().opening).toBeUndefined();
  draw(view);
  act(() => {
    (lastDraw().onBack as () => void)();
  });
  expect(screen.queryByTestId('draw')).toBeNull();
  expect(screen.getByTestId('viewer')).toBeInTheDocument();
  expect(lastViewer().opening).toBe(view);
});

it('opens plain again once the viewer was closed after coming back', () => {
  render(thread(jest.fn()));
  openViewer();
  draw(view);
  act(() => {
    (lastDraw().onBack as () => void)();
  });
  act(() => {
    (lastViewer().onClose as () => void)();
  });
  expect(screen.queryByTestId('viewer')).toBeNull();
  openViewer();
  expect(lastViewer().opening).toBeUndefined();
});

it('attaches to the chat and closes the viewer too', () => {
  const onAttachPicture = jest.fn();
  render(thread(onAttachPicture));
  openViewer();
  draw(undefined);
  const image = new Uint8Array([4, 2]);
  act(() => {
    (lastDraw().onAttach as (image: Uint8Array) => void)(image);
  });
  expect(onAttachPicture).toHaveBeenCalledWith(image);
  expect(screen.queryByTestId('draw')).toBeNull();
  expect(screen.queryByTestId('viewer')).toBeNull();
});

it('keeps the drawing’s way back the same function while it is open', () => {
  const rendered = render(thread(jest.fn()));
  openViewer();
  draw(undefined);
  const first = lastDraw().onBack;
  rendered.rerender(thread(jest.fn()));
  // The sketch decodes its picture again whenever its close changes.
  expect(lastDraw().onBack).toBe(first);
});
