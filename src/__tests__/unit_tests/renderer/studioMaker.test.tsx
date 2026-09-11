/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import StudioMaker from '../../../renderer/studio/StudioMaker';
import StudioNewProjectDialog from '../../../renderer/studio/StudioNewProjectDialog';
import StudioPanel from '../../../renderer/studio/StudioPanel';
import { resetStudioIdea } from '../../../renderer/studio/studioIdea';
import { resetStudioStore } from '../../../renderer/studio/studioStore';

// The empty Studio does not request audio; capture is owned by the app shell.
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const project: IStudioProject = {
  id: '11111111-1111-4111-8111-111111111111',
  folderName: 'Northern Lights',
  path: 'D:\\Studio\\Northern Lights',
};

const bridge = {
  showStudioFolder: jest.fn(),
  createStudioProject: jest.fn(),
  chooseStudioProjectsRoot: jest.fn(),
  openStudio: jest.fn(),
  closeStudio: jest.fn(),
  onStudioChanged: jest.fn(() => () => undefined),
};

let clipboard: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  resetStudioIdea();
  resetStudioStore();
  clipboard = undefined;
  bridge.showStudioFolder.mockResolvedValue(undefined);
  bridge.closeStudio.mockResolvedValue(undefined);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: jest.fn(async (text: string) => {
        clipboard = text;
      }),
    },
  });
});

describe('making a scene with your AI', () => {
  it('copies the prompt with the idea on the end, and keeps the idea', async () => {
    render(<StudioMaker project={project} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.idea.city.label' }),
    );
    const idea = screen.getByRole('textbox', {
      name: 'studio.maker.describe',
    });
    // The example is in the field, where it can be changed.
    expect(idea).toHaveValue('studio.idea.city.text');
    await userEvent.type(idea, ' With rain.');
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.action.copyPrompt' }),
    );
    expect(clipboard).toBe(promptWithIdea('studio.idea.city.text With rain.'));
    // Copying took nothing away: the idea is still there, and the button
    // says it worked until the idea changes.
    expect(idea).toHaveValue('studio.idea.city.text With rain.');
    expect(
      screen.getByRole('button', { name: 'studio.maker.copied' }),
    ).toBeInTheDocument();
    await userEvent.type(idea, '!');
    expect(
      screen.getByRole('button', { name: 'studio.action.copyPrompt' }),
    ).toBeInTheDocument();
  });

  it('keeps the idea when the Studio is left and opened again', async () => {
    const { unmount } = render(<StudioMaker />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'studio.maker.describe' }),
      'A cat on a piano',
    );
    unmount();
    render(<StudioMaker project={project} />);
    expect(
      screen.getByRole('textbox', { name: 'studio.maker.describe' }),
    ).toHaveValue('A cat on a piano');
  });

  it('gives the folder to open in the AI assistant once there is one', async () => {
    const { rerender } = render(<StudioMaker />);
    expect(screen.getByText('studio.maker.openNoProject')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studio.maker.copyPath' }),
    ).not.toBeInTheDocument();
    rerender(<StudioMaker project={project} />);
    expect(screen.getByText(project.path)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.maker.copyPath' }),
    );
    expect(clipboard).toBe(project.path);
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.action.showFolder' }),
    );
    expect(bridge.showStudioFolder).toHaveBeenCalled();
  });

  it('shows and selects the prompt when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(() => Promise.reject(new Error('denied'))) },
    });
    render(<StudioMaker project={project} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.action.copyPrompt' }),
    );
    expect(
      await screen.findByText('studio.notice.copyFailed'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'studio.prompt.label' }),
    ).toBeInTheDocument();
  });
});

describe('a new project', () => {
  it('asks for a name only, and shows where it will go', async () => {
    const onClose = jest.fn();
    bridge.createStudioProject.mockResolvedValue('written');
    render(<StudioNewProjectDialog root="D:\Studio" onClose={onClose} />);
    const create = screen.getByRole('button', { name: 'studio.new.create' });
    expect(create).toBeDisabled();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'studio.new.name' }),
      'Northern Lights',
    );
    expect(screen.getByText('\\Northern Lights')).toBeInTheDocument();
    await userEvent.click(create);
    expect(bridge.createStudioProject).toHaveBeenCalledWith('Northern Lights');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('says so when that folder is already there, and stays open', async () => {
    const onClose = jest.fn();
    bridge.createStudioProject.mockResolvedValue('exists');
    render(<StudioNewProjectDialog root="D:\Studio" onClose={onClose} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'studio.new.name' }),
      'Vinyl{Enter}',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'studio.new.exists:Vinyl',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('changes where projects go from the same place', async () => {
    bridge.chooseStudioProjectsRoot.mockResolvedValue(undefined);
    render(<StudioNewProjectDialog root="D:\Studio" onClose={jest.fn()} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.new.change' }),
    );
    expect(bridge.chooseStudioProjectsRoot).toHaveBeenCalled();
  });
});

describe('opening the Studio', () => {
  it('shows loading, not an empty scene, while the selected project is being read', async () => {
    bridge.openStudio.mockResolvedValue({
      entitled: true,
      projects: [project],
      activeId: project.id,
    });
    render(<StudioPanel />);
    expect(await screen.findByText('studio.stage.loading')).toBeInTheDocument();
    expect(
      screen.queryByText('studio.stage.startTitle'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('studio.stage.empty')).not.toBeInTheDocument();
  });
  it('shows no Plus offer while it is still asking whether there is Plus', async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.openStudio.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<StudioPanel />);
    expect(screen.queryByText('studio.gate.title')).not.toBeInTheDocument();
    answer({ entitled: true, projectsRoot: 'D:\\Studio', projects: [] });
    // With Plus and no project yet: the stage says how to start one.
    expect(
      await screen.findByText('studio.stage.startTitle'),
    ).toBeInTheDocument();
    expect(screen.queryByText('studio.gate.title')).not.toBeInTheDocument();
  });
});
