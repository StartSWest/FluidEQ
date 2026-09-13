/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ's scenes, opened in the Studio to look inside: "Open in Studio" on
 * a scene's page, the Studio's way to them, how such a project is listed, and
 * the share card that says it is not one to keep or send instead of offering
 * buttons that would be refused.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import type {
  IStudioProject,
  IStudioState,
} from '../../../main/ipc/memberScenes';
import SceneInspectButton from '../../../renderer/plus/SceneInspectButton';
import {
  resetGalleryActions,
  useGalleryNotice,
} from '../../../renderer/plus/galleryActions';
import {
  resetPlusNavigation,
  usePlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import StudioBench from '../../../renderer/studio/StudioBench';
import StudioProjects from '../../../renderer/studio/StudioProjects';
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

const inspectOfficialScene = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetGalleryActions();
  resetPlusNavigation();
  resetStudioStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        inspectOfficialScene,
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
      },
    },
  });
});

describe('"Open in Studio" on a FluidEQ scene', () => {
  it('sends only the scene’s id, and takes the member to the Studio', async () => {
    inspectOfficialScene.mockResolvedValue('opened');
    const navigation = renderHook(() => usePlusNavigation());
    render(<SceneInspectButton sceneId="aurora" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.inspect.open' }),
    );
    expect(inspectOfficialScene).toHaveBeenCalledWith('aurora');
    expect(navigation.result.current.place).toBe('studio');
    expect(screen.getByText('plus.inspect.hint')).toBeInTheDocument();
  });

  it('stays on the page and says why when it could not be opened', async () => {
    const notice = renderHook(() => useGalleryNotice());
    const navigation = renderHook(() => usePlusNavigation());
    inspectOfficialScene.mockResolvedValue('unavailable');
    render(<SceneInspectButton sceneId="aurora" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.inspect.open' }),
    );
    expect(notice.result.current).toEqual({
      ok: false,
      key: 'plus.inspect.unavailable',
    });
    inspectOfficialScene.mockResolvedValue('taken');
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.inspect.open' }),
    );
    expect(notice.result.current).toEqual({
      ok: false,
      key: 'plus.inspect.failed',
    });
    // The control: nothing moved the member away.
    expect(navigation.result.current.place).toBe('visualizers');
  });
});

describe("the Studio's list of projects", () => {
  const state: IStudioState = {
    entitled: true,
    projectsRoot: 'D:\\Studio',
    activeId: MINE.id,
    projects: [FLUIDEQS, MINE],
  };

  it('files a FluidEQ scene under its own heading, after the member’s own', async () => {
    render(
      <StudioProjects
        state={state}
        onNewProject={jest.fn()}
        onOpenFile={jest.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    const headings = screen
      .getAllByText(/^studio\.project\.group/)
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'studio.project.group',
      'studio.project.groupOfficial',
    ]);
  });

  it('leads to FluidEQ’s scenes in the gallery, where each opens in the Studio', async () => {
    const navigation = renderHook(() => usePlusNavigation());
    render(
      <StudioProjects
        state={state}
        onNewProject={jest.fn()}
        onOpenFile={jest.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.inspect' }),
    );
    expect(navigation.result.current.place).toBe('visualizers');
    expect(navigation.result.current.page).toEqual({
      kind: 'maker',
      maker: {
        authorId: FLUIDEQ_CREATOR_ID,
        name: 'FluidEQ',
        handle: 'fluideq',
      },
    });
  });
});

describe('the share card', () => {
  const view = (active: IStudioProject): IStudioView => ({
    loaded: true,
    serial: 1,
    pack: memberPack(),
    state: {
      entitled: true,
      projectsRoot: 'D:\\Studio',
      projects: [active],
      activeId: active.id,
    },
  });

  it('says what a FluidEQ scene opened to look inside is, in place of keeping and sending it', async () => {
    const { rerender } = render(<StudioBench view={view(FLUIDEQS)} />);
    await screen.findByRole('textbox', { name: 'studio.maker.describe' });
    expect(screen.getByText('studio.inspect.title')).toBeInTheDocument();
    expect(screen.getByText('studio.inspect.body')).toBeInTheDocument();
    [
      'studio.action.addToLooks',
      'studio.action.publish',
      'studio.action.export',
    ].forEach((name) =>
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument(),
    );

    // The control: the member's own project offers all three.
    await act(async () => {
      rerender(<StudioBench view={view(MINE)} />);
    });
    [
      'studio.action.addToLooks',
      'studio.action.publish',
      'studio.action.export',
    ].forEach((name) =>
      expect(screen.getByRole('button', { name })).toBeInTheDocument(),
    );
    expect(screen.queryByText('studio.inspect.title')).not.toBeInTheDocument();
  });
});
