/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio for every signed-in account (Ivan, 2026-10-18: the Studio and
 * publishing are free): the whole editor, any number of projects, nothing
 * locked. A maker's own scene plays for them everywhere, published or not
 * (2026-10-21: "no need to publish to run on grahp"), so the stage wears no
 * draft mark and Add to looks is the loud way out, Publish the quiet one.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import { requestAccountPanel } from '../../../renderer/account/accountPanel';
import StudioBench from '../../../renderer/studio/StudioBench';
import {
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';
import { useCanSetDesktop } from '../../../renderer/wallpaper/WallpaperControls';
import { useOwnsLook } from '../../../renderer/plus/sceneStore';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { memberPack } from '../../utils/memberSceneFixtures';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  // No capture running: nothing is heard for the member's AI.
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));

// The stage itself is the GPU's; what is held here is what it is told.
jest.mock('../../../renderer/studio/StudioStage', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <canvas
      data-testid="studio-stage"
      data-draft={'draft' in props ? 'given' : 'none'}
    />
  ),
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  ...jest.requireActual('../../../renderer/account/accountStore'),
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30' },
  }),
}));

jest.mock('../../../renderer/plus/sceneStore', () => ({
  ...jest.requireActual('../../../renderer/plus/sceneStore'),
  useOwnsLook: jest.fn(() => false),
}));

jest.mock('../../../renderer/wallpaper/WallpaperControls', () => ({
  useCanSetDesktop: jest.fn(() => true),
}));

const project: IStudioProject = {
  id: '11111111-1111-4111-8111-111111111111',
  folderName: 'Neon City',
  path: 'D:\\Studio\\Neon City',
};

const view = (over: Partial<IStudioView['state']> = {}): IStudioView => ({
  loaded: true,
  serial: 1,
  pack: memberPack(),
  state: {
    mayAddProject: true,
    projectsRoot: 'D:\\Studio',
    projects: [project],
    activeId: project.id,
    ...over,
  },
});

const selectStudioProject = jest.fn(async () => undefined);

beforeEach(() => {
  resetStudioStore();
  resetStudioChatStore();
  jest.clearAllMocks();
  jest.mocked(useCanSetDesktop).mockReturnValue(true);
  jest.mocked(useOwnsLook).mockReturnValue(false);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(project.id),
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
        selectStudioProject,
      },
    },
  });
});

/** The project menu, opened from the bar at the top of the bench. */
const openMenu = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.project.label' }),
  );
  const menu = document.querySelector('.studio-projects-menu');
  if (!(menu instanceof HTMLElement)) {
    throw new Error('the project menu did not open');
  }
  return within(menu);
};

it('gives the whole editor to a signed-in account, with no Plus anywhere', async () => {
  render(<StudioBench view={view()} />);
  expect(screen.getByTestId('studio-stage')).toBeInTheDocument();
  expect(
    await screen.findByRole('textbox', { name: 'studioChat.label' }),
  ).toBeInTheDocument();
  const menu = await openMenu();
  [
    'studio.project.new',
    'studio.project.add',
    'studio.project.inspect',
  ].forEach((name) =>
    expect(menu.getByRole('button', { name })).not.toHaveAttribute('title'),
  );
  await userEvent.click(
    menu.getByRole('button', { name: 'studio.project.new' }),
  );
  expect(requestAccountPanel).not.toHaveBeenCalled();
  expect(screen.getByText('studio.new.title')).toBeInTheDocument();
});

it('wears no draft mark and makes Add to looks the loud way out, published or not', async () => {
  // Never published: the store says the look is not owned.
  render(<StudioBench view={view()} />);
  await screen.findByRole('textbox', { name: 'studioChat.label' });
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'data-draft',
    'none',
  );
  expect(
    screen.getByRole('button', { name: 'studio.action.publish' }),
  ).toHaveClass('subtle');
  expect(
    screen.getByRole('button', { name: 'studio.action.addToLooks' }),
  ).not.toHaveClass('subtle');
});

it('offers every way out under More with no lock, and no desktop where there can be none', async () => {
  render(<StudioBench view={view()} />);
  await screen.findByRole('textbox', { name: 'studioChat.label' });
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.ship.more' }),
  );
  ['studio.action.export', 'studio.action.desktop'].forEach((name) =>
    expect(screen.getByRole('menuitem', { name })).not.toHaveAttribute('title'),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.ship.more' }),
  );

  jest.mocked(useCanSetDesktop).mockReturnValue(false);
  render(<StudioBench view={view()} />);
  const [, more] = screen.getAllByRole('button', { name: 'studio.ship.more' });
  await userEvent.click(more);
  expect(
    screen.queryAllByRole('menuitem', { name: 'studio.action.desktop' }),
  ).toHaveLength(0);
});

it('says what a FluidEQ scene opened to look inside is for, with nothing to keep', async () => {
  render(
    <StudioBench view={view({ projects: [{ ...project, official: true }] })} />,
  );
  await screen.findByText('studioChat.inspect');
  expect(screen.getByText('studio.inspect.title')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'studio.action.addToLooks' }),
  ).toBeNull();
});
