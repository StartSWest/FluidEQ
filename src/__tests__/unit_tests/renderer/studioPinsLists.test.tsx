/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Pins where they are seen (Ivan, 2026-11-13: "pin chats / projects to the
 * top"): the project picker files pinned projects first under their own
 * heading, newest pin first, with a pin beside each row that says which it
 * is; the earlier chats of a project put their pinned ones first, and a
 * deleted chat takes its pin with it. Each case beside the one that must not.
 */

const account: { identity?: { id: string } } = { identity: { id: 'ana' } };
jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => account,
  useAccount: () => account,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const pastChats: IStudioChatPast[] = [
  { id: 'c1', title: 'Make the moon rise', savedAt: 1, source: 'fluideq' },
  { id: 'c2', title: 'Slower stars', savedAt: 2, source: 'fluideq' },
  { id: 'c3', title: 'Warmer sky', savedAt: 3, source: 'fluideq' },
];
const deletePastStudioChat = jest.fn((_id: string) => Promise.resolve());
jest.mock('../../../renderer/studio/chat/studioChatStore', () => ({
  ...jest.requireActual('../../../renderer/studio/chat/studioChatStore'),
  useStudioChat: () => ({
    past: pastChats,
    chat: { projectId: 'p1', busy: false },
    work: {},
  }),
  loadPastStudioChats: () => Promise.resolve(),
  openPastStudioChat: () => Promise.resolve(),
  deletePastStudioChat: (id: string) => deletePastStudioChat(id),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { IStudioChatPast } from '../../../common/studioChat';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import StudioChatPast from '../../../renderer/studio/chat/StudioChatPast';
import { resetStudioPinsCache } from '../../../renderer/studio/studioPins';
/* eslint-enable import/first */

const project = (id: string, name: string) => ({
  id,
  folderName: name,
  path: `C:\\Scenes\\${name}`,
});

const studio = (): IStudioState =>
  ({
    mayAddProject: true,
    projectsRoot: 'C:\\Scenes',
    projects: [
      project('p1', 'Aurora'),
      project('p2', 'Balloons'),
      project('p3', 'Coral'),
    ],
    activeId: 'p1',
  }) as IStudioState;

beforeEach(() => {
  window.localStorage.clear();
  resetStudioPinsCache();
  deletePastStudioChat.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onStudioChatEntry: () => () => undefined,
        myPublishedScenes: async () => ({ ok: true, scenes: [] }),
        mySceneSubmissions: async () => ({ ok: true, submissions: [] }),
      },
    },
  });
});

const openPicker = async () => {
  await act(async () => {
    render(
      <StudioProjects
        state={studio()}
        onNewProject={() => undefined}
        onLinkFolder={() => undefined}
        onOpenFile={() => undefined}
      />,
    );
  });
  fireEvent.click(
    screen.getByRole('button', { name: /studio\.project\.label/ }),
  );
};

const rowNames = () =>
  screen
    .getAllByRole('menuitemradio')
    .map((row) => row.querySelector('strong')?.textContent);

describe('the project picker', () => {
  it('files pinned projects first, newest pin first, under their own heading', async () => {
    await openPicker();
    // The control: unpinned, the list is in its own order.
    expect(rowNames()).toEqual(['Aurora', 'Balloons', 'Coral']);
    expect(screen.queryByText('studio.project.groupPinned')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Coral' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Balloons' }),
    );
    expect(rowNames()).toEqual(['Balloons', 'Coral', 'Aurora']);
    expect(screen.getByText('studio.project.groupPinned')).toBeInTheDocument();
    // Each pin says which it is, to the eye and to a screen reader.
    const pinned = screen.getByRole('button', {
      name: 'studio.pin.remove: Balloons',
    });
    expect(pinned).toHaveAttribute('aria-pressed', 'true');
    expect(pinned).toHaveClass('rich-pick__star', 'is-pin', 'is-on');
    expect(
      screen.getByRole('button', { name: 'studio.pin.add: Aurora' }),
    ).toHaveAttribute('aria-pressed', 'false');
    // Unpinned, it goes back to its own place.
    fireEvent.click(pinned);
    expect(rowNames()).toEqual(['Coral', 'Aurora', 'Balloons']);
  });

  it('keeps the pins when the picker opens again', async () => {
    await openPicker();
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Coral' }),
    );
    resetStudioPinsCache();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.studio.pins.v1:ana') ?? '{}',
      ),
    ).toEqual({ projects: ['p3'], chats: {} });
  });
});

describe('a project’s earlier chats', () => {
  const titles = () =>
    within(screen.getByRole('list', { name: 'studioChat.past.title' }))
      .getAllByRole('listitem')
      .map(
        (item) => item.querySelector('.studio-chat-past__title')?.textContent,
      );

  it('puts pinned chats first, newest pin first, lit while pinned', async () => {
    await act(async () => {
      render(<StudioChatPast onOpened={() => undefined} />);
    });
    expect(titles()).toEqual([
      'Make the moon rise',
      'Slower stars',
      'Warmer sky',
    ]);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Warmer sky' }),
    );
    expect(titles()).toEqual([
      'Warmer sky',
      'Make the moon rise',
      'Slower stars',
    ]);
    expect(
      screen.getByRole('button', { name: 'studio.pin.remove: Warmer sky' }),
    ).toHaveClass('studio-chat-past__pin', 'is-on');
  });

  it('drops a deleted chat’s pin, and keeps the others', async () => {
    await act(async () => {
      render(<StudioChatPast onOpened={() => undefined} />);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Slower stars' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.pin.add: Warmer sky' }),
    );
    const item = screen.getByText('Slower stars').closest('li') as HTMLElement;
    fireEvent.click(
      within(item).getByRole('button', { name: 'studioChat.past.delete' }),
    );
    await act(async () => {
      fireEvent.click(
        within(item).getByRole('button', { name: 'common.icon.delete' }),
      );
    });
    expect(deletePastStudioChat).toHaveBeenCalledWith('c2');
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.studio.pins.v1:ana') ?? '{}',
      ).chats,
    ).toEqual({ p1: ['c3'] });
  });
});
