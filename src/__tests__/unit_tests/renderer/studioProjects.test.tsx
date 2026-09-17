/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
import type { IScenePack } from '../../../common/scenePacks';
import { MAX_VERSION_NOTE } from '../../../common/sceneVersionNote';

// The camera owns WebGL; these tests exercise the dialog and real cover list.
jest.mock('../../../renderer/studio/StudioPublishCamera', () => () => null);

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
  mayAddProject: true,
  projectsRoot: 'D:\\scenes',
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
  it('cycles the complete list in stable order even when recent projects move', async () => {
    const forest = {
      id: '33333333-3333-4333-8333-333333333333',
      folderName: 'forest',
      path: 'D:\\scenes\\forest',
    };
    const props = { onNewProject: jest.fn(), onOpenFile: jest.fn() };
    const { rerender } = render(
      <StudioProjects
        onNewProject={props.onNewProject}
        onLinkFolder={jest.fn()}
        onOpenFile={props.onOpenFile}
        state={{ ...state, projects: [...state.projects, forest] }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.next' }),
    );
    expect(bridge.selectStudioProject).toHaveBeenLastCalledWith(forest.id);
    rerender(
      <StudioProjects
        onNewProject={props.onNewProject}
        onLinkFolder={jest.fn()}
        onOpenFile={props.onOpenFile}
        state={{
          ...state,
          activeId: forest.id,
          projects: [forest, ...state.projects],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.next' }),
    );
    expect(bridge.selectStudioProject).toHaveBeenLastCalledWith(SEA);
    rerender(
      <StudioProjects
        onNewProject={props.onNewProject}
        onLinkFolder={jest.fn()}
        onOpenFile={props.onOpenFile}
        state={{
          ...state,
          activeId: SEA,
          projects: [state.projects[1], forest, state.projects[0]],
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.next' }),
    );
    expect(bridge.selectStudioProject).toHaveBeenLastCalledWith(CITY);
    rerender(
      <StudioProjects
        onNewProject={props.onNewProject}
        onLinkFolder={jest.fn()}
        onOpenFile={props.onOpenFile}
        state={{ ...state, projects: [...state.projects, forest] }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.previous' }),
    );
    expect(bridge.selectStudioProject).toHaveBeenLastCalledWith(SEA);
  });

  it.each([0, 1])('does not cycle a list of %s projects', (length) => {
    render(
      <StudioProjects
        state={{ ...state, projects: state.projects.slice(0, length) }}
        onNewProject={jest.fn()}
        onLinkFolder={jest.fn()}
        onOpenFile={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'studio.project.previous' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'studio.project.next' }),
    ).toBeDisabled();
  });

  // The control: the open project is named, the others are a click away.
  it('names the open project and opens another by its id', async () => {
    render(
      <StudioProjects
        state={state}
        onNewProject={jest.fn()}
        onLinkFolder={jest.fn()}
        onOpenFile={jest.fn()}
      />,
    );
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
    const onNewProject = jest.fn();
    const onLinkFolder = jest.fn();
    render(
      <StudioProjects
        state={state}
        onNewProject={onNewProject}
        onLinkFolder={onLinkFolder}
        onOpenFile={jest.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.new' }),
    );
    expect(onNewProject).toHaveBeenCalled();
    // The menu closed as the action began.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.label' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.project.add' }),
    );
    // The bench opens the folder, so it can say what came of it.
    expect(onLinkFolder).toHaveBeenCalled();
    expect(bridge.linkStudioFolder).not.toHaveBeenCalled();
  });
});

describe('the publish dialog', () => {
  const pack: IScenePack = {
    schema: 1,
    id: 'neon-city',
    version: 3,
    contract: 1,
    names: { en: 'Neon City' },
    fallbackStyle: 'skyline',
    swatch: ['#050a1a', '#00e5cf'],
    source: '',
    params: [],
  };

  const draft = (over: Partial<IPublishDraft> = {}): IPublishDraft => ({
    shots: [
      {
        id: 1,
        kind: 'auto',
        picture: {
          bytes: new Uint8Array(8),
          url: 'data:image/webp;base64,UklGRg==',
        },
      },
    ],
    chosen: 1,
    missed: false,
    agreed: true,
    ...over,
  });

  it('publishes nothing until a category is chosen', async () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft()}
        running={false}
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    const go = screen.getByRole('button', { name: 'studio.publish.go' });
    expect(go).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.category.space' }),
    );
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(onPublish).toHaveBeenCalledWith('space', undefined, undefined);
  });

  it('asks what is new only of an update, and sends it with the publication', async () => {
    const onPublish = jest.fn();
    const published = {
      sceneId: 'neon-city',
      version: 3,
      category: 'cities',
    } as IPublishDraft['published'];
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({ published })}
        running={false}
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    const note = screen.getByLabelText('studio.publish.note');
    expect(note).toHaveAttribute('maxLength', String(MAX_VERSION_NOTE));
    await userEvent.type(note, 'The peaks stay whole');
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goUpdate' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith(
      'cities',
      undefined,
      'The peaks stay whole',
    );
  });

  it('files a scene under up to two categories, the first staying first', async () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft()}
        running={false}
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    // The order number is hidden from the name: a screen reader hears the
    // chosen state, and the category, not a stray digit.
    const chip = (name: string) =>
      screen.getByRole('button', { name: `plus.category.${name}` });
    await userEvent.click(chip('cities'));
    await userEvent.click(chip('water'));
    expect(chip('cities')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('water')).toHaveAttribute('aria-pressed', 'true');
    // A third takes the second's place.
    await userEvent.click(chip('space'));
    expect(chip('water')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('space')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.go' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith('cities', 'space', undefined);
    // Unpicking the first moves the second up.
    await userEvent.click(chip('cities'));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.go' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith('space', undefined, undefined);
  });

  it('selects completed covers and identifies captures still being drawn', async () => {
    const onChoose = jest.fn();
    const { rerender } = render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={onChoose}
        draft={draft()}
        running={false}
        onPublish={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /studio.publish.shot:1/ }),
    );
    expect(onChoose).toHaveBeenCalledWith(1);
    rerender(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({
          shots: [...draft().shots, { id: 2, kind: 'captured' }],
        })}
        running={false}
        onPublish={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'studio.publish.capturing' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /studio.publish.shot:2/ }),
    ).not.toBeInTheDocument();
  });

  it('asks for the agreement the first time, and starts an update on its category', () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({
          agreed: false,
          published: {
            sceneId: 'neon-city',
            version: 2,
            category: 'water',
            category2: 'cities',
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
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', {
        name: 'studio.publish.titleUpdate:Neon City',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'plus.category.water' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'plus.category.cities' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // A new version of a scene people already have goes out with a line
    // saying what changed, always: the update notice and the versions page
    // are built around it, and without one a listener is asked to take a new
    // version on trust. The press is what says so — a held button with the
    // reason in a tooltip is a reason nobody ever reads.
    const go = screen.getByRole('button', { name: 'studio.publish.agree' });
    const field = screen.getByLabelText('studio.publish.note');
    expect(go).toBeEnabled();
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(go);
    expect(onPublish).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.publish.needNote',
    );
    expect(field).toHaveFocus();
    // And it clears as soon as there is something to publish with.
    fireEvent.change(field, {
      target: { value: 'the peaks no longer get cut on wide panels' },
    });
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(go);
    expect(onPublish).toHaveBeenCalledWith(
      'water',
      'cities',
      'the peaks no longer get cut on wide panels',
    );
  });

  // The line the member's AI wrote about its own change, offered as the note.
  // Nobody remembers what changed three days later; the assistant that
  // changed it does, and it writes the line beside the scene.
  it('opens the note on what the AI wrote, and publishes with it', () => {
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({
          suggestedNote: 'the rain falls behind the signs now',
          published: {
            sceneId: 'neon-city',
            version: 2,
            category: 'cities',
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
        onPublish={onPublish}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('studio.publish.note')).toHaveValue(
      'the rain falls behind the signs now',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goUpdate' }),
    );
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      'the rain falls behind the signs now',
    );
  });
});
