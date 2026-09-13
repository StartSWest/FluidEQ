/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's two panes. The stage and what makes it scroll in one, what
 * tests and tunes it in the other, so going down the side column to a slider
 * keeps the scene being tuned in view. The scrolling itself is the
 * stylesheet's; what is held here is which pane each part is in, since a card
 * moved into the wrong one scrolls the stage away again and still passes
 * every other test.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
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
  it('keeps the stage and the making in the pane beside the side column', async () => {
    const { container } = render(<StudioBench view={view} />);
    const { main, side } = panesOf(container);

    expect(main).toContainElement(screen.getByTestId('studio-stage'));
    expect(main).toContainElement(
      await screen.findByRole('textbox', { name: 'studio.maker.describe' }),
    );
    // The control: the side column's own card is found, and not in the
    // stage's pane.
    const add = screen.getByRole('button', {
      name: 'studio.action.addToLooks',
    });
    expect(side).toContainElement(add);
    expect(main).not.toContainElement(add);
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
});
