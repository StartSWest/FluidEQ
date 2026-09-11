/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const CITY = '11111111-1111-4111-8111-111111111111';
const SEA = '22222222-2222-4222-8222-222222222222';

const state: IStudioState = {
  entitled: true,
  activeId: CITY,
  projects: [
    {
      id: CITY,
      folderName: 'city',
      path: 'D:\\scenes\\city',
      names: { en: 'Neon City' },
    },
    { id: SEA, folderName: 'sea', path: 'D:\\scenes\\sea' },
  ],
};

const bridge = {
  selectStudioProject: jest.fn(),
  createStudioStarter: jest.fn(),
  linkStudioFolder: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  bridge.selectStudioProject.mockResolvedValue(state);
  bridge.linkStudioFolder.mockResolvedValue(state);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the Studio’s projects', () => {
  // The control: the open project is named, the others are a click away.
  it('names the open project and opens another by its id', async () => {
    render(<StudioProjects state={state} onStarterExists={jest.fn()} />);
    const trigger = screen.getByRole('button', {
      name: 'studio.project.label',
    });
    expect(trigger).toHaveTextContent('Neon City');
    expect(trigger).toHaveAttribute('title', 'D:\\scenes\\city');
    await userEvent.click(trigger);
    // A project whose pack.json could not be read goes by its folder.
    await userEvent.click(screen.getByRole('menuitemradio', { name: /sea/ }));
    expect(bridge.selectStudioProject).toHaveBeenCalledWith(SEA);
  });

  it('starts a new project or adds a folder from under the list', async () => {
    const onStarterExists = jest.fn();
    bridge.createStudioStarter.mockResolvedValue('exists');
    render(<StudioProjects state={state} onStarterExists={onStarterExists} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.new' }),
    );
    expect(bridge.createStudioStarter).toHaveBeenCalled();
    await waitFor(() => expect(onStarterExists).toHaveBeenCalled());
    // The menu closed as the action began.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.add' }),
    );
    expect(bridge.linkStudioFolder).toHaveBeenCalled();
  });
});

describe('the publish dialog', () => {
  const draft = (over: Partial<IPublishDraft> = {}): IPublishDraft => ({
    picture: new Uint8Array(8),
    pictureUrl: 'data:image/webp;base64,UklGRg==',
    agreed: true,
    ...over,
  });

  it('publishes nothing until a category is chosen', async () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        version={3}
        draft={draft()}
        running={false}
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    const go = screen.getByRole('button', { name: 'studio.publish.go' });
    expect(go).toBeDisabled();
    await userEvent.click(
      screen.getByRole('radio', { name: 'plus.category.space' }),
    );
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(onPublish).toHaveBeenCalledWith('space');
  });

  it('asks for the agreement the first time, and starts an update on its category', () => {
    render(
      <StudioPublishDialog
        name="Neon City"
        version={3}
        draft={draft({
          agreed: false,
          published: {
            sceneId: 'neon-city',
            version: 2,
            category: 'water',
            names: { en: 'Neon City' },
            swatch: ['#050a1a', '#00e5cf'],
            likes: 1,
            adds: 1,
            publishedAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
            blocked: false,
          },
        })}
        running={false}
        onPublish={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', {
        name: 'studio.publish.titleUpdate:Neon City',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'plus.category.water' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('button', { name: 'studio.publish.agree' }),
    ).toBeEnabled();
  });
});
