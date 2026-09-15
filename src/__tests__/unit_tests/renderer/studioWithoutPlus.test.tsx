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
  linkStudioFolder,
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';
import { useCanSetDesktop } from '../../../renderer/wallpaper/WallpaperControls';
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

jest.mock('../../../renderer/wallpaper/WallpaperControls', () => ({
  useCanSetDesktop: jest.fn(() => true),
}));

jest.mock('../../../renderer/studio/studioStore', () => ({
  ...jest.requireActual('../../../renderer/studio/studioStore'),
  linkStudioFolder: jest.fn(async () => 'cancelled'),
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

/** The bridge's project pick: never reached for a locked project. */
const selectStudioProject = jest.fn(async () => undefined);

beforeEach(() => {
  resetStudioStore();
  jest.clearAllMocks();
  jest.mocked(useCanSetDesktop).mockReturnValue(true);
  jest.mocked(linkStudioFolder).mockResolvedValue('cancelled');
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
        selectStudioProject,
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
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
  const locked = [
    'studio.action.addToLooks',
    'studio.action.publish',
    'studio.action.export',
    'studio.action.desktop',
  ];
  // One press at a time, as a member presses: clicks started together
  // overlap their act() scopes and land in no fixed order.
  await locked.reduce(async (previous, name) => {
    await previous;
    const button = screen.getByRole('button', { name });
    expect(button).toHaveAttribute('title', 'studio.plus.locked');
    await userEvent.click(button);
  }, Promise.resolve());
  expect(requestAccountPanel).toHaveBeenCalledTimes(locked.length);
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(screen.getByText('studio.plus.body')).toBeInTheDocument();
});

it('locks no desktop on a computer that cannot have one, as Plus offers none there', async () => {
  jest.mocked(useCanSetDesktop).mockReturnValue(false);
  render(<StudioBench view={view()} />);
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
  expect(
    screen.queryByRole('button', { name: 'studio.action.desktop' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'studio.action.export' }),
  ).toBeInTheDocument();
});

it('offers those four for real once there is Plus', async () => {
  render(<StudioBench view={view({ entitled: true, mayAddProject: true })} />);
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
  const add = screen.getByRole('button', {
    name: 'studio.action.addToLooks',
  });
  expect(add).not.toHaveAttribute('title');
  await userEvent.click(add);
  expect(requestAccountPanel).not.toHaveBeenCalled();
  expect(screen.queryByText('studio.plus.body')).not.toBeInTheDocument();
});

it('says what a FluidEQ scene opened to look inside is for, whatever the membership', async () => {
  render(
    <StudioBench
      view={view({
        entitled: true,
        mayAddProject: true,
        projects: [{ ...project, official: true }],
      })}
    />,
  );
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
  expect(screen.getByText('studio.inspect.title')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'studio.action.addToLooks' }),
  ).toBeNull();
});

it('lists a project Plus would open with a lock, and opens Plus when it is picked', async () => {
  const aurora: IStudioProject = {
    id: '22222222-2222-4222-8222-222222222222',
    folderName: 'Aurora',
    path: 'D:\\Studio\\Aurora',
    locked: true,
  };
  render(<StudioBench view={view({ projects: [project, aurora] })} />);
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
  // One project to step to: the arrows have nowhere to go.
  expect(
    screen.getByRole('button', { name: 'studio.project.next' }),
  ).toBeDisabled();
  const menu = await openMenu();
  const row = menu.getByRole('menuitemradio', { name: /Aurora/ });
  expect(row).toHaveAttribute('title', 'studio.plus.lockedProject');
  expect(row).toHaveClass('is-locked');
  expect(
    menu.getByRole('menuitemradio', { name: /Neon City/ }),
  ).not.toHaveAttribute('title');
  await userEvent.click(row);
  expect(requestAccountPanel).toHaveBeenCalledWith('subscribe');
  expect(selectStudioProject).not.toHaveBeenCalled();
});

it('says so when the first of a folder of several opens without Plus', async () => {
  jest.mocked(linkStudioFolder).mockResolvedValue('one-opened');
  render(
    <StudioBench
      view={view({ mayAddProject: true, projects: [], activeId: undefined })}
    />,
  );
  const menu = await openMenu();
  await userEvent.click(
    menu.getByRole('button', { name: 'studio.project.add' }),
  );
  expect(await screen.findByText('studio.plus.oneFolder')).toBeInTheDocument();
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
  await screen.findByRole('textbox', { name: 'studio.maker.describe' });
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
