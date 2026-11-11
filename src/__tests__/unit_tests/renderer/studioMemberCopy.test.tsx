/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A member's scene opened in the Studio as a copy to look inside: where it is
 * filed, what stands where keeping and sending would be, and the chat card
 * that says why it asks before every command and offers nothing to press.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import { resetGalleryActions } from '../../../renderer/plus/galleryActions';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import StudioBench from '../../../renderer/studio/StudioBench';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import {
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { memberPack } from '../../utils/memberSceneFixtures';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  // No capture running: nothing is heard for the member's AI.
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));

jest.mock('../../../renderer/studio/StudioStageSound', () => ({
  __esModule: true,
  default: () => <canvas data-testid="studio-stage" />,
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const MINE: IStudioProject = {
  id: '11111111-1111-4111-8111-111111111111',
  folderName: 'Aurora',
  path: 'D:\\Studio\\Aurora',
  names: { en: 'Aurora' },
};
const FLUIDEQS: IStudioProject = {
  id: '22222222-2222-4222-8222-222222222222',
  folderName: 'Aurora (FluidEQ)',
  path: 'D:\\Studio\\Aurora (FluidEQ)',
  names: { en: 'Aurora' },
  official: true,
};
const COPY: IStudioProject = {
  id: '33333333-3333-4333-8333-333333333333',
  folderName: 'Glass Garden (kai v6)',
  path: 'D:\\Studio\\Glass Garden (kai v6)',
  names: { en: 'Glass Garden' },
  member: { maker: 'kai', version: 6 },
  outside: true,
};
const OPENED: IStudioProject = {
  id: '44444444-4444-4444-8444-444444444444',
  folderName: 'Lake',
  path: 'D:\\Downloads\\Lake',
  names: { en: 'Lake' },
  outside: true,
};

const trustStudioProject = jest.fn(async () => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  resetGalleryActions();
  resetPlusNavigation();
  resetStudioStore();
  resetStudioChatStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(),
        trustStudioProject,
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
      },
    },
  });
});

describe("the Studio's list of projects", () => {
  const listed = (activeId: string) => (
    <StudioProjects
      state={{
        mayAddProject: true,
        projectsRoot: 'D:\\Studio',
        activeId,
        projects: [COPY, FLUIDEQS, MINE],
      }}
      onNewProject={jest.fn()}
      onLinkFolder={jest.fn()}
      onOpenFile={jest.fn()}
    />
  );

  it('files a member’s copy under its own heading, after FluidEQ’s scenes', async () => {
    render(listed(MINE.id));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    const headings = screen
      .getAllByText(/^studio.project.group/)
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'studio.project.group',
      'studio.project.groupOfficial',
      'studio.project.groupMember',
    ]);
  });

  it('offers no rename for a copy, where the member’s own project has one', async () => {
    const { unmount } = render(listed(COPY.id));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    expect(screen.queryByText('studio.project.rename')).not.toBeInTheDocument();
    unmount();
    // The control.
    render(listed(MINE.id));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    expect(screen.getByText('studio.project.rename')).toBeInTheDocument();
  });
});

describe('a member’s copy on the bench', () => {
  const view = (active: IStudioProject): IStudioView => ({
    loaded: true,
    serial: 1,
    pack: memberPack(),
    state: {
      mayAddProject: true,
      projectsRoot: 'D:\\Studio',
      projects: [active],
      activeId: active.id,
    },
  });

  it('says whose scene it is in place of keeping and sending it, and its chat stays open', async () => {
    render(<StudioBench view={view(COPY)} />);
    expect(
      await screen.findByRole('textbox', { name: 'studioChat.label' }),
    ).toBeInTheDocument();
    expect(screen.getByText('studio.memberCopy.title')).toBeInTheDocument();
    expect(screen.getByText('studio.memberCopy.body')).toBeInTheDocument();
    [
      'studio.action.addToLooks',
      'studio.action.publish',
      'studio.ship.more',
    ].forEach((name) =>
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument(),
    );
  });

  it('says its chat asks before every command, and offers nothing to trust', async () => {
    render(<StudioBench view={view(COPY)} />);
    const card = await screen.findByRole('region', {
      name: 'studioChat.memberCopy.title',
    });
    expect(within(card).queryAllByRole('button')).toEqual([]);
    expect(
      screen.queryByRole('button', { name: 'studioChat.outside.trust' }),
    ).not.toBeInTheDocument();
    expect(trustStudioProject).not.toHaveBeenCalled();
  });

  it('the control: a folder from outside offers the trust press, and no copy card', async () => {
    render(<StudioBench view={view(OPENED)} />);
    expect(
      await screen.findByRole('button', { name: 'studioChat.outside.trust' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'studioChat.memberCopy.title' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('studio.memberCopy.title'),
    ).not.toBeInTheDocument();
  });
});
