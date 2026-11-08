/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The project list says which scenes are done (Ivan, 2026-11-08: "show in
 * the list published if last version is on the lib on the server for all
 * ... and no more changes were made ... once AI start working on it it shows
 * AI working instead of published"): Published while the version published
 * from its folder is live and the folder is unchanged, In review while that
 * version waits, nothing once it changed - and its AI's state over all.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IPublishedScene } from '../../../common/plusGallery';
import type { ISceneSubmission } from '../../../common/plusReview';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { releaseOf } from '../../../renderer/studio/useProjectsReleased';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const live = (sceneId: string, version: number): IPublishedScene =>
  ({ sceneId, version, blocked: false }) as IPublishedScene;
const sent = (
  sceneId: string,
  version: number,
  state: ISceneSubmission['state'],
): ISceneSubmission => ({ sceneId, version, state }) as ISceneSubmission;
const published = (version: number, unchanged = true) => ({
  published: { sceneId: 'lake', version, unchanged },
});

describe('where a project stands in the gallery', () => {
  it('is published when its version is live and its folder unchanged', () => {
    expect(releaseOf(published(3), [live('lake', 3)], [])).toBe('published');
  });

  it('is nothing once its folder changed, even with that version live', () => {
    expect(releaseOf(published(3, false), [live('lake', 3)], [])).toBe(
      undefined,
    );
  });

  it('is nothing when the gallery holds another version, or took it down', () => {
    expect(releaseOf(published(3), [live('lake', 2)], [])).toBe(undefined);
    expect(
      releaseOf(published(3), [{ ...live('lake', 3), blocked: true }], []),
    ).toBe(undefined);
    expect(releaseOf({}, [live('lake', 3)], [])).toBe(undefined);
  });

  it('is in review while that version waits, and not when it was refused', () => {
    expect(
      releaseOf(published(4), [live('lake', 3)], [sent('lake', 4, 'pending')]),
    ).toBe('review');
    expect(releaseOf(published(4), [], [sent('lake', 4, 'rejected')])).toBe(
      undefined,
    );
  });
});

type TEntryListener = (change: {
  projectId: string;
  entry: TStudioChatEntry;
  busy: boolean;
}) => void;

let entry: TEntryListener | undefined;

const A = 'aaaaaaaa-0000-4000-8000-000000000001';

const studio = (): IStudioState =>
  ({
    mayAddProject: true,
    projectsRoot: 'C:\\Scenes',
    projects: [
      {
        id: A,
        folderName: 'Lake',
        path: 'C:\\Scenes\\Lake',
        published: { sceneId: 'lake', version: 3, unchanged: true },
      },
    ],
    activeId: A,
  }) as IStudioState;

beforeEach(() => {
  resetStudioChatStore();
  entry = undefined;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onStudioChatEntry: (listener: TEntryListener) => {
          entry = listener;
          return () => undefined;
        },
        myPublishedScenes: async () => ({
          ok: true,
          scenes: [live('lake', 3)],
        }),
        mySceneSubmissions: async () => ({ ok: true, submissions: [] }),
      },
    },
  });
});

const rowState = () =>
  screen
    .getAllByRole('menuitemradio')[0]
    .querySelector('.studio-projects__state')?.textContent ?? '';

it('says Published in the list, and its AI working instead the moment it starts', async () => {
  // The listener for chat news is set up by the window's store.
  const { watchStudioChat } =
    await import('../../../renderer/studio/chat/studioChatStore');
  watchStudioChat();
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
  expect(rowState()).toBe('studio.project.published');

  act(() => {
    entry?.({
      projectId: A,
      entry: { kind: 'claude', id: 'r', text: '', steps: [], state: 'working' },
      busy: true,
    });
  });
  expect(rowState()).toBe('studio.project.aiWorking');
});
