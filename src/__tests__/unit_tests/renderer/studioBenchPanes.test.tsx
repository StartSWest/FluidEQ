/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's two panes (layout A, 2026-09-27; the chat took the second on
 * 2026-10-09): the stage and the work on it, in tabs under it — what it is
 * played with and what it hears among them — in one; the chat with Claude
 * that makes it in the other; and the ways out of the Studio in the bar above
 * both. What is held here is which pane each part is in, since a part moved
 * into the wrong one scrolls the stage away again and still passes every
 * other test.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import StudioBench from '../../../renderer/studio/StudioBench';
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

// The stage without a GPU, keeping the controls laid over its foot: the sizes
// are on the stage now, not in the side column.
jest.mock('../../../renderer/studio/StudioStage', () => ({
  __esModule: true,
  default: ({ controls }: { controls?: import('react').ReactNode }) => (
    <div>
      <canvas data-testid="studio-stage" />
      {controls}
    </div>
  ),
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const project: IStudioProject = {
  id: '11111111-1111-4111-8111-111111111111',
  folderName: 'Northern Lights',
  path: 'D:\\Studio\\Northern Lights',
};

const view: IStudioView = {
  loaded: true,
  serial: 1,
  pack: memberPack(),
  state: {
    entitled: true,
    maker: false,
    mayAddProject: true,
    projectsRoot: 'D:\\Studio',
    projects: [project],
    activeId: project.id,
  },
};

beforeEach(() => {
  resetStudioStore();
  resetStudioChatStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(project.id),
        onStudioChanged: jest.fn(() => () => undefined),
        readStudioNotes: jest.fn(async () => ({ description: '', prompt: '' })),
        saveStudioNotes: jest.fn(async () => true),
      },
    },
  });
});

const panesOf = (container: HTMLElement) => {
  const top = container.querySelector('.studio-bench__top');
  const main = container.querySelector('.studio-bench__main');
  const side = container.querySelector('.studio-bench__chat');
  if (
    !(top instanceof HTMLElement) ||
    !(main instanceof HTMLElement) ||
    !(side instanceof HTMLElement)
  ) {
    throw new Error('the bench is missing its project bar or a pane');
  }
  return { top, main, side };
};

describe("the Studio's panes", () => {
  it('keeps the stage and the work on it, what it hears included, in one pane, the chat in the other, and the ways out in the bar', async () => {
    const { container } = render(<StudioBench view={view} />);
    // The chat asks for Claude Code and the project's conversation on
    // arrival; settled first.
    const composer = await screen.findByRole('textbox', {
      name: 'studioChat.label',
    });
    const { top, main, side } = panesOf(container);

    expect(main).toContainElement(screen.getByTestId('studio-stage'));
    // The chat that makes the scene is the pane beside the stage, not a tab.
    expect(side).toContainElement(composer);
    expect(main).not.toContainElement(composer);
    // The work is in tabs under the stage; what it hears is one of them.
    const tabs = screen.getByRole('tablist', { name: 'studio.work.label' });
    expect(main).toContainElement(tabs);
    expect(
      within(tabs).queryByRole('tab', { name: 'studio.work.make' }),
    ).toBeNull();
    await userEvent.click(
      within(tabs).getByRole('tab', { name: 'studio.meters.title' }),
    );
    const hears = screen.getByRole('group', { name: 'studio.signals.title' });
    expect(main).toContainElement(hears);
    expect(side).not.toContainElement(hears);
    // The control: the bar's own actions are found, and in neither pane.
    const add = screen.getByRole('button', {
      name: 'studio.action.addToLooks',
    });
    expect(top).toContainElement(add);
    expect(main).not.toContainElement(add);
    expect(side).not.toContainElement(add);
  });

  it('keeps the two panes apart, under the project bar', async () => {
    const { container } = render(<StudioBench view={view} />);
    // The chat asks for Claude Code and the project's conversation on
    // arrival; settled first.
    await screen.findByRole('textbox', { name: 'studioChat.label' });
    const { top, main, side } = panesOf(container);

    expect(main).not.toContainElement(side);
    expect(side).not.toContainElement(main);
    expect(main).not.toContainElement(top);
    expect(side).not.toContainElement(top);
    expect(main.parentElement).toBe(side.parentElement);
  });

  it('puts the graph’s divider under the stage', async () => {
    const { container } = render(<StudioBench view={view} />);
    await screen.findByRole('textbox', { name: 'studioChat.label' });
    const divider = screen.getByRole('separator', {
      name: 'studio.stage.resize',
    });
    expect(container.querySelector('.studio-bench__stage')).toContainElement(
      divider,
    );
  });

  it('has no divider before there is a project to try on the graph', async () => {
    render(
      <StudioBench
        view={{
          ...view,
          pack: undefined,
          state: { ...view.state, projects: [], activeId: undefined },
        }}
      />,
    );
    // With no project the chat says where the first one starts.
    await screen.findByText('studioChat.noProject');
    expect(
      screen.queryByRole('separator', { name: 'studio.stage.resize' }),
    ).toBeNull();
  });
});
