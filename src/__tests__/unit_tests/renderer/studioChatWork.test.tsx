/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's scene picker says what each scene's chat is doing (Ivan,
 * 2026-11-07: "I should be able to keep working in parallel on every
 * scene"): working while its AI answers, replied once it finished on a scene
 * the member was not on — until that scene is opened — and the picker's own
 * button says so when the news is on another scene.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  TStudioChatAsk,
  TStudioChatEntry,
} from '../../../common/studioChat';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import {
  loadStudioChat,
  resetStudioChatStore,
} from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';

const studio = (activeId: string): IStudioState =>
  ({
    mayAddProject: true,
    projectsRoot: 'C:\\Scenes',
    projects: [
      { id: A, folderName: 'Alpine', path: 'C:\\Scenes\\Alpine' },
      { id: B, folderName: 'Beach', path: 'C:\\Scenes\\Beach' },
      { id: C, folderName: 'Canyon', path: 'C:\\Scenes\\Canyon' },
    ],
    activeId,
  }) as IStudioState;

type TEntryListener = (change: {
  projectId: string;
  entry: TStudioChatEntry;
  busy: boolean;
}) => void;

type TAskListener = (change: {
  projectId: string;
  ask?: TStudioChatAsk;
}) => void;

let entry: TEntryListener | undefined;
let asking: TAskListener | undefined;
let open = A;

/** A card going up on a project's chat, or (undefined) coming down. */
const carded = (projectId: string, up: boolean) =>
  act(() => {
    asking?.({
      projectId,
      ...(up
        ? {
            ask: {
              id: 'k-1',
              projectId,
              kind: 'tool',
              tool: 'Bash',
              detail: 'node make-picture.mjs',
            },
          }
        : {}),
    });
  });

const reply = (id: string): TStudioChatEntry => ({
  kind: 'claude',
  id,
  text: '',
  steps: [],
  state: 'working',
});

/** Main's word on a project's chat, as each reply grows or ends. */
const told = (projectId: string, busy: boolean) =>
  act(() => {
    entry?.({ projectId, entry: reply(`r-${projectId}`), busy });
  });

/** The Studio opening a project, which loads its chat. */
const opened = async (projectId: string) => {
  open = projectId;
  await act(async () => {
    await loadStudioChat();
  });
};

beforeEach(() => {
  resetStudioChatStore();
  entry = undefined;
  asking = undefined;
  open = A;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onStudioChatEntry: (listener: TEntryListener) => {
          entry = listener;
          return () => undefined;
        },
        onStudioChatAsk: (listener: TAskListener) => {
          asking = listener;
          return () => undefined;
        },
        studioChatLoad: async () => ({
          projectId: open,
          entries: [],
          busy: false,
        }),
      },
    },
  });
});

const trigger = () =>
  screen.getByRole('button', { name: /studio\.project\.label/ });

/** What a project's row says its chat is doing, at its end. */
const rowState = (name: string) => {
  const row = screen
    .getAllByRole('menuitemradio')
    .find((item) => item.textContent?.includes(name));
  return row?.querySelector('.studio-projects__state')?.textContent ?? '';
};

const showMenu = () => {
  if (screen.queryAllByRole('menuitemradio').length === 0) {
    fireEvent.click(trigger());
  }
};

test('another scene at work, then replied, then seen once opened', async () => {
  const view = render(
    <StudioProjects
      state={studio(A)}
      onNewProject={jest.fn()}
      onLinkFolder={jest.fn()}
      onOpenFile={jest.fn()}
    />,
  );
  await opened(A);
  expect(trigger()).toHaveAccessibleName('studio.project.label');

  told(B, true);
  expect(trigger()).toHaveAccessibleName(
    'studio.project.label · studio.project.aiWorkingElsewhere',
  );
  showMenu();
  expect(rowState('Beach')).toBe('studio.project.aiWorking');
  expect(rowState('Alpine')).toBe('');

  told(B, false);
  expect(trigger()).toHaveAccessibleName(
    'studio.project.label · studio.project.aiRepliedElsewhere',
  );
  expect(rowState('Beach')).toBe('studio.project.aiReplied');

  // The member opens Beach: its reply is seen.
  await opened(B);
  view.rerender(
    <StudioProjects
      state={studio(B)}
      onNewProject={jest.fn()}
      onLinkFolder={jest.fn()}
      onOpenFile={jest.fn()}
    />,
  );
  expect(trigger()).toHaveAccessibleName('studio.project.label');
  showMenu();
  expect(rowState('Beach')).toBe('');
});

test('a scene whose AI waits on a card says so, first of all news, until it is answered', async () => {
  render(
    <StudioProjects
      state={studio(A)}
      onNewProject={jest.fn()}
      onLinkFolder={jest.fn()}
      onOpenFile={jest.fn()}
    />,
  );
  await opened(A);
  // A third scene has replied meanwhile: the wait still comes first.
  told(C, true);
  told(C, false);
  told(B, true);
  carded(B, true);
  told(B, true);
  expect(trigger()).toHaveAccessibleName(
    'studio.project.label · studio.project.aiWaitingElsewhere',
  );
  showMenu();
  expect(rowState('Beach')).toBe('studio.project.aiWaiting');

  // Answered, the AI goes back to work; done, it has replied.
  carded(B, false);
  expect(rowState('Beach')).toBe('studio.project.aiWorking');
  told(B, false);
  expect(rowState('Beach')).toBe('studio.project.aiReplied');
});

test('the open scene finishing is not called news', async () => {
  render(
    <StudioProjects
      state={studio(A)}
      onNewProject={jest.fn()}
      onLinkFolder={jest.fn()}
      onOpenFile={jest.fn()}
    />,
  );
  await opened(A);
  told(A, true);
  showMenu();
  expect(rowState('Alpine')).toBe('studio.project.aiWorking');
  // Working on the open scene is not news about another one.
  expect(trigger()).toHaveAccessibleName('studio.project.label');
  told(A, false);
  expect(rowState('Alpine')).toBe('');
  expect(trigger()).toHaveAccessibleName('studio.project.label');
});
