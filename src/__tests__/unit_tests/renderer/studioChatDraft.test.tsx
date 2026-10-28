/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio chat's message box keeps each scene's own unsent words (Ivan,
 * 2026-10-26: "the app restarted and I lost the message — save it per
 * scene"): through the pane going and coming back, through a restart, and
 * per project, until the message is sent.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioProject } from '../../../main/ipc/studioProjectTypes';
import type { IStudioChatDraft } from '../../../main/studioChat/chatDraft';
import StudioChat from '../../../renderer/studio/chat/StudioChat';
import { resetChatDrafts } from '../../../renderer/studio/chat/chatDraftStore';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { forgetStudioProject } from '../../../renderer/studio/studioStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
// The guide and the conversation have nothing to do with the box.
jest.mock('../../../renderer/studio/StudioStartHere', () => () => null);
jest.mock('../../../renderer/studio/chat/StudioChatThread', () => () => null);

const project = (id: string): IStudioProject => ({
  id,
  folderName: id,
  path: `C:\\Scenes\\${id}`,
});
const A = project('11111111-2222-4333-8444-555555555555');
const B = project('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');

let kept: Map<string, IStudioChatDraft>;
let api: Record<string, jest.Mock>;

/** A window opening afresh, with main holding `kept`. */
const freshWindow = () => {
  resetStudioChatStore();
  resetChatDrafts();
  api = {
    studioChatAvailability: jest.fn(async () => ({ state: 'ready' })),
    studioChatCodex: jest.fn(async () => undefined),
    studioChatLoad: jest.fn(async () => undefined),
    studioChatSend: jest.fn(async () => undefined),
    studioChatDraft: jest.fn(async (id: string) => kept.get(id)),
    studioChatDraftChange: jest.fn(
      async (change: { projectId: string; text?: string }) => {
        if (change.text !== undefined) {
          kept.set(change.projectId, { text: change.text });
        }
      },
    ),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
};

const box = () =>
  screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: 'studioChat.label',
  });

beforeEach(() => {
  kept = new Map();
  freshWindow();
});

it('keeps the words when the pane goes and comes back', async () => {
  const first = render(<StudioChat project={A} />);
  fireEvent.change(await box(), { target: { value: 'make the ring pulse' } });
  first.unmount();
  render(<StudioChat project={A} />);
  expect(await box()).toHaveValue('make the ring pulse');
});

it('gives the words back after a restart', async () => {
  const first = render(<StudioChat project={A} />);
  fireEvent.change(await box(), { target: { value: 'make the ring pulse' } });
  expect(api.studioChatDraftChange).toHaveBeenLastCalledWith({
    projectId: A.id,
    text: 'make the ring pulse',
  });
  first.unmount();
  freshWindow();
  render(<StudioChat project={A} />);
  const words = await box();
  await act(async () => undefined);
  expect(words).toHaveValue('make the ring pulse');
});

it('shows each scene its own words', async () => {
  const view = render(<StudioChat project={A} />);
  fireEvent.change(await box(), { target: { value: 'for A' } });
  view.rerender(<StudioChat project={B} />);
  expect(await box()).toHaveValue('');
  fireEvent.change(await box(), { target: { value: 'for B' } });
  view.rerender(<StudioChat project={A} />);
  expect(await box()).toHaveValue('for A');
});

it('lets what the member types win over a draft that arrives late', async () => {
  kept.set(A.id, { text: 'old words' });
  let answer: (draft: IStudioChatDraft) => void = () => undefined;
  api.studioChatDraft.mockImplementation(
    () =>
      new Promise<IStudioChatDraft>((resolve) => {
        answer = resolve;
      }),
  );
  render(<StudioChat project={A} />);
  fireEvent.change(await box(), { target: { value: 'new words' } });
  await act(async () => answer({ text: 'old words' }));
  expect(await box()).toHaveValue('new words');
});

it('gives back the stage picture with its words after a restart', async () => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:stage',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
  kept.set(A.id, {
    text: 'this, but red',
    stage: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  });
  render(<StudioChat project={A} />);
  expect(
    await screen.findByRole('button', { name: 'studioChat.sketch.remove' }),
  ).toBeInTheDocument();
  expect(await box()).toHaveValue('this, but red');
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.sketch.remove' }),
  );
  expect(api.studioChatDraftChange).toHaveBeenLastCalledWith({
    projectId: A.id,
    stage: null,
  });
});

it('takes a project’s draft with it when the project is removed', async () => {
  api.forgetStudioProject = jest.fn(async () => ({
    mayAddProject: true,
    projectsRoot: 'C:\\Scenes',
    projects: [],
  }));
  render(<StudioChat project={A} />);
  fireEvent.change(await box(), { target: { value: 'never sent' } });
  await act(() => forgetStudioProject(A.id));
  expect(api.studioChatDraftChange).toHaveBeenLastCalledWith({
    projectId: A.id,
    text: '',
    stage: null,
  });
  expect(await box()).toHaveValue('');
});

it('clears the words once they are sent', async () => {
  render(<StudioChat project={A} />);
  const words = await box();
  fireEvent.change(words, { target: { value: 'send this' } });
  await act(async () => {
    fireEvent.keyDown(words, { key: 'Enter' });
  });
  expect(api.studioChatSend).toHaveBeenCalled();
  expect(words).toHaveValue('');
  expect(api.studioChatDraftChange).toHaveBeenCalledWith({
    projectId: A.id,
    text: '',
  });
  expect(kept.get(A.id)).toEqual({ text: '' });
});
