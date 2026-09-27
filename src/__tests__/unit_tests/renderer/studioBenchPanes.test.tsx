/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's two panes (layout A, 2026-09-27): the stage and the work on
 * it, in tabs under it, in one; what it is played with and what it hears in
 * the other; and the ways out of the Studio in the bar above both. What is
 * held here is which pane each part is in, since a part moved into the wrong
 * one scrolls the stage away again and still passes every other test.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import StudioBench from '../../../renderer/studio/StudioBench';
import {
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';
import { memberPack } from '../../utils/memberSceneFixtures';

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

const panesOf = (container: HTMLElement) => {
  const top = container.querySelector('.studio-bench__top');
  const main = container.querySelector('.studio-bench__main');
  const side = container.querySelector('.studio-bench__side');
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
  it('keeps the stage and the work on it in one pane, what it hears in the other, and the ways out in the bar', async () => {
    const { container } = render(<StudioBench view={view} />);
    const { top, main, side } = panesOf(container);

    expect(main).toContainElement(screen.getByTestId('studio-stage'));
    // The work is a tab under the stage; making it with an AI is the first.
    expect(main).toContainElement(
      screen.getByRole('tablist', { name: 'studio.work.label' }),
    );
    expect(main).toContainElement(
      await screen.findByRole('textbox', { name: 'studio.maker.describe' }),
    );
    expect(side).toContainElement(
      screen.getByRole('group', { name: 'studio.signals.title' }),
    );
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
    // The making card reads the project's notes on arrival; settled first.
    await screen.findByRole('textbox', { name: 'studio.maker.describe' });
    const { top, main, side } = panesOf(container);

    expect(main).not.toContainElement(side);
    expect(side).not.toContainElement(main);
    expect(main).not.toContainElement(top);
    expect(side).not.toContainElement(top);
    expect(main.parentElement).toBe(side.parentElement);
  });

  it('puts the graph’s divider under the stage at the graph’s size, and none at the fixed panels', async () => {
    const { container } = render(<StudioBench view={view} />);
    await screen.findByRole('textbox', { name: 'studio.maker.describe' });
    const divider = screen.getByRole('separator', {
      name: 'studio.stage.resize',
    });
    expect(container.querySelector('.studio-bench__stage')).toContainElement(
      divider,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'studio.size.wide' }),
    );
    expect(
      screen.queryByRole('separator', { name: 'studio.stage.resize' }),
    ).toBeNull();
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
    await screen.findByRole('textbox', { name: 'studio.maker.describe' });
    expect(
      screen.queryByRole('separator', { name: 'studio.stage.resize' }),
    ).toBeNull();
  });
});
