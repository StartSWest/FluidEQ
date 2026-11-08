/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture from outside goes with the Studio chat's message (Ivan,
 * 2026-11-07: "I also need to be able to paste image into the chat with
 * control v", "or attach images from outside"): pasted, dropped on the box,
 * or chosen with the picture button, it takes the stage picture's place —
 * kept with the draft, to be drawn on and sent — and words pasted stay words.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioProject } from '../../../main/ipc/studioProjectTypes';
import StudioChat from '../../../renderer/studio/chat/StudioChat';
import { resetChatDrafts } from '../../../renderer/studio/chat/chatDraftStore';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/studio/StudioStartHere', () => () => null);
jest.mock('../../../renderer/studio/chat/StudioChatThread', () => () => null);

/** What the converter makes of any picture: a JPEG's first bytes. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]);
const mockConvert = jest.fn(async (_file: Blob) => JPEG);
jest.mock('../../../renderer/studio/chat/chatPictureIn', () => ({
  ...jest.requireActual('../../../renderer/studio/chat/chatPictureIn'),
  chatPictureIn: (file: Blob) => mockConvert(file),
}));

const A: IStudioProject = {
  id: '11111111-2222-4333-8444-555555555555',
  folderName: 'Lake',
  path: 'C:\\Scenes\\Lake',
};

let api: Record<string, jest.Mock>;

beforeEach(() => {
  resetStudioChatStore();
  resetChatDrafts();
  mockConvert.mockClear();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:picture',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
  api = {
    studioChatAvailability: jest.fn(async () => ({ state: 'ready' })),
    studioChatCodex: jest.fn(async () => undefined),
    studioChatLoad: jest.fn(async () => undefined),
    studioChatDraft: jest.fn(async () => undefined),
    studioChatDraftChange: jest.fn(async () => undefined),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
});

const box = () =>
  screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: 'studioChat.label',
  });

const picture = (name = 'reference.png', type = 'image/png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

/** The picture handed on as the message's, as the draft keeps it. */
const kept = () =>
  api.studioChatDraftChange.mock.calls
    .map(([change]) => change as { stage?: Uint8Array | null })
    .filter((change) => change.stage instanceof Uint8Array);

const attached = () =>
  screen.queryByRole('button', { name: 'studioChat.sketch.remove' });

it('takes a picture pasted with Ctrl+V as the message picture', async () => {
  render(<StudioChat project={A} />);
  const words = await box();
  const image = picture();
  await act(async () => {
    fireEvent.paste(words, { clipboardData: { files: [image] } });
  });
  expect(mockConvert).toHaveBeenCalledWith(image);
  expect(kept()).toHaveLength(1);
  expect(Array.from(kept()[0].stage ?? [])).toEqual(Array.from(JPEG));
  expect(attached()).toBeInTheDocument();
});

it('leaves words pasted as words', async () => {
  render(<StudioChat project={A} />);
  const words = await box();
  let goesOn = false;
  await act(async () => {
    // Its default kept is the browser pasting the words into the box.
    goesOn = fireEvent.paste(words, { clipboardData: { files: [] } });
  });
  expect(goesOn).toBe(true);
  expect(mockConvert).not.toHaveBeenCalled();
  expect(attached()).not.toBeInTheDocument();
});

it('takes a picture dropped on the box, and nothing else that is dropped', async () => {
  render(<StudioChat project={A} />);
  const words = await box();
  const area = words.closest('.studio-chat__box');
  if (!area) {
    throw new Error('no message box');
  }
  await act(async () => {
    fireEvent.drop(area, {
      dataTransfer: {
        types: ['Files'],
        files: [new File(['x'], 'notes.txt', { type: 'text/plain' })],
      },
    });
  });
  expect(mockConvert).not.toHaveBeenCalled();
  const image = picture('photo.jpg', 'image/jpeg');
  await act(async () => {
    fireEvent.drop(area, {
      dataTransfer: { types: ['Files'], files: [image] },
    });
  });
  expect(mockConvert).toHaveBeenCalledWith(image);
  expect(attached()).toBeInTheDocument();
});

it('takes a picture chosen with the picture button', async () => {
  render(<StudioChat project={A} />);
  await box();
  expect(
    screen.getByRole('button', { name: 'studioChat.attachPicture' }),
  ).toBeEnabled();
  const input = document.querySelector<HTMLInputElement>(
    '.studio-chat__composer input[type="file"]',
  );
  if (!input) {
    throw new Error('no file input');
  }
  expect(input).toHaveAttribute('accept', 'image/*');
  const image = picture();
  await act(async () => {
    fireEvent.change(input, { target: { files: [image] } });
  });
  expect(mockConvert).toHaveBeenCalledWith(image);
  expect(attached()).toBeInTheDocument();
});
