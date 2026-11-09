/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture drawn on in the chat's picture viewer lands in that chat's
 * message box (Ivan, 2026-11-09: "draw also on zoomed pic inside the chat
 * and attach them to the chat"): the scene's chat keeps it with the draft,
 * as a pasted picture is kept, and an animation's animator holds it in its
 * own box. Each beside the control of the box with nothing attached.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IStudioProject } from '../../../main/ipc/studioProjectTypes';
import AnimatorChat from '../../../renderer/studio/animations/AnimatorChat';
import StudioChat from '../../../renderer/studio/chat/StudioChat';
import { resetAnimatorChatStore } from '../../../renderer/studio/chat/animatorChatStore';
import { resetChatDrafts } from '../../../renderer/studio/chat/chatDraftStore';
import {
  checkStudioChat,
  resetStudioChatStore,
} from '../../../renderer/studio/chat/studioChatStore';

const mockThreadProps: Array<Record<string, unknown>> = [];

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/studio/StudioStartHere', () => () => null);
jest.mock('../../../renderer/studio/chat/StudioChatThread', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockThreadProps.push(props);
    return null;
  },
}));

const A: IStudioProject = {
  id: '11111111-2222-4333-8444-555555555555',
  folderName: 'Lake',
  path: 'C:\\Scenes\\Lake',
};

/** What the drawing hands on: a JPEG's first bytes. */
const DRAWN = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7]);

let api: Record<string, unknown>;

beforeEach(() => {
  mockThreadProps.length = 0;
  resetStudioChatStore();
  resetAnimatorChatStore();
  resetChatDrafts();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:drawn',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
  Element.prototype.scrollIntoView = jest.fn();
  api = {
    studioChatAvailability: jest.fn(async () => ({ state: 'ready' })),
    studioChatCodex: jest.fn(async () => undefined),
    studioChatLoad: jest.fn(async () => undefined),
    studioChatDraft: jest.fn(async () => undefined),
    studioChatDraftChange: jest.fn(async () => undefined),
    studioAnimatorLoad: jest.fn(async () => undefined),
    onStudioChatEntry: () => () => undefined,
    onStudioChatQueue: () => () => undefined,
    onStudioChatContext: () => () => undefined,
    onStudioChatAsk: () => () => undefined,
    onStudioChatLimits: () => () => undefined,
    onStudioChatPack: () => () => undefined,
    onStudioAnimatorStart: () => () => undefined,
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: api },
  });
});

const attached = () =>
  screen.queryByRole('button', { name: 'studioChat.sketch.remove' });

const attachDrawn = () =>
  act(() => {
    const thread = mockThreadProps[mockThreadProps.length - 1];
    (thread.onAttachPicture as (image: Uint8Array) => void)(DRAWN);
  });

it('lands in the scene chat’s box, kept with the draft', async () => {
  render(<StudioChat project={A} />);
  await act(async () => undefined);
  // Control: nothing is attached until the drawing is.
  expect(attached()).toBeNull();
  attachDrawn();
  expect(attached()).toBeInTheDocument();
  const kept = (api.studioChatDraftChange as jest.Mock).mock.calls
    .map(([change]) => change as { projectId: string; stage?: unknown })
    .filter((change) => change.stage instanceof Uint8Array);
  expect(kept).toHaveLength(1);
  expect(kept[0].projectId).toBe(A.id);
  expect(Array.from(kept[0].stage as Uint8Array)).toEqual(Array.from(DRAWN));
});

it('lands in the animator’s own box', async () => {
  await act(async () => {
    await checkStudioChat();
  });
  render(<AnimatorChat projectId={A.id} name="wolf-walk" />);
  await act(async () => undefined);
  expect(attached()).toBeNull();
  attachDrawn();
  expect(attached()).toBeInTheDocument();
});
