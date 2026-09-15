/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio without Plus: the whole editor, one project, and every way of
 * taking a scene out of this window shown locked rather than hidden.
 *
 * What the member may actually do is the main process's answer; what is held
 * here is that the page offers nothing it would refuse, and that each lock
 * leads to Plus instead of doing nothing.
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
import { memberPack } from '../../utils/memberSceneFixtures';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));

jest.mock('../../../renderer/studio/StudioStage', () => ({
  __esModule: true,
  default: () => <canvas data-testid="studio-stage" />,
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

jest.mock('../../../renderer/account/accountPanel', () => ({
  requestAccountPanel: jest.fn(),
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
    entitled: false,
    mayAddProject: false,
    projectsRoot: 'D:\\Studio',
    projects: [project],
    activeId: project.id,
    ...over,
  },
});

beforeEach(() => {
  resetStudioStore();
  jest.clearAllMocks();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
      },
    },
  });
});

it('gives the whole editor to a member without Plus', async () => {
  render(<StudioBench view={view()} />);
  expect(screen.getByTestId('studio-stage')).toBeInTheDocument();
  expect(
    await screen.findByRole('textbox', { name: 'studio.maker.describe' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'studio.action.copyPrompt' }),
  ).toBeEnabled();
});

it('shows the four ways out locked, and opens Plus instead of doing them', async () => {
  render(<StudioBench view={view()} />);
  const locked = [
    'studio.action.addToLooks',
    'studio.action.publish',
    'studio.action.export',
    'studio.action.desktop',
  ];
  await Promise.all(
    locked.map(async (name) => {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('title', 'studio.plus.locked');
      await userEvent.click(button);
    }),
  );
  expect(requestAccountPanel).toHaveBeenCalledTimes(locked.length);
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(screen.getByText('studio.plus.body')).toBeInTheDocument();
});

it('offers those four for real once there is Plus', async () => {
  render(<StudioBench view={view({ entitled: true, mayAddProject: true })} />);
  const add = screen.getByRole('button', {
    name: 'studio.action.addToLooks',
  });
  expect(add).not.toHaveAttribute('title', 'studio.plus.locked');
  await userEvent.click(add);
  expect(requestAccountPanel).not.toHaveBeenCalled();
  expect(screen.queryByText('studio.plus.body')).not.toBeInTheDocument();
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

it('locks the ways to a second project, and says the Studio keeps one', async () => {
  render(<StudioBench view={view()} />);
  const menu = await openMenu();
  const starting = menu.getByRole('button', { name: 'studio.project.new' });
  expect(starting).toHaveAttribute('title', 'studio.plus.oneProject');
  expect(
    menu.getByRole('button', { name: 'studio.project.add' }),
  ).toHaveAttribute('title', 'studio.plus.oneProject');
  // FluidEQ's own scenes, and another member's file, are Plus's as well.
  expect(
    menu.getByRole('button', { name: 'studio.project.inspect' }),
  ).toHaveAttribute('title', 'studio.plus.locked');
  expect(
    menu.getByRole('button', { name: 'studio.action.import' }),
  ).toHaveAttribute('title', 'studio.plus.locked');

  await userEvent.click(starting);
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(screen.queryByText('studio.new.title')).toBeNull();
});

it('starts the first project without Plus, with no lock on it', async () => {
  render(
    <StudioBench
      view={view({ mayAddProject: true, projects: [], activeId: undefined })}
    />,
  );
  const menu = await openMenu();
  const starting = menu.getByRole('button', { name: 'studio.project.new' });
  expect(starting).not.toHaveAttribute('title');
  await userEvent.click(starting);
  expect(requestAccountPanel).not.toHaveBeenCalled();
  expect(screen.getByText('studio.new.title')).toBeInTheDocument();
});
