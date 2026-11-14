/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStudioState } from '../../../main/ipc/memberScenes';
import {
  resetAccountStore,
  subscribeAccount,
} from '../../../renderer/account/accountStore';
import {
  registerRendererAddon,
  resetRendererAddons,
} from '../../../renderer/addons';
import StudioProjects from '../../../renderer/studio/StudioProjects';
import StudioPublishDialog from '../../../renderer/studio/StudioPublishDialog';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
import type { IScenePack } from '../../../common/scenePacks';
import {
  MAX_VERSION_NOTE,
  notesAsWritten,
} from '../../../common/sceneVersionNote';

// The recorder's own tests cover media/lifecycle. Dialog cases receive a
// completed camera result while exercising the real category/note/cover gates.
jest.mock('../../../renderer/studio/StudioPublishCamera', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  return function Camera({
    source,
    onPreview,
  }: {
    source: string;
    onPreview: (value: unknown) => void;
  }) {
    useLayoutEffect(() => {
      onPreview({
        source,
        blob: new Blob(['clip']),
        durationMs: 10000,
        width: 640,
        height: 360,
      });
    }, [source, onPreview]);
    return null;
  };
});

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

const PUBLISHER = '33333333-3333-4333-8333-333333333333';

const bridge = {
  selectStudioProject: jest.fn(),
  createStudioStarter: jest.fn(),
  linkStudioFolder: jest.fn(),
  getAccountState: jest.fn(),
  onAccountState: jest.fn(() => () => {}),
};

beforeEach(() => {
  jest.clearAllMocks();
  bridge.selectStudioProject.mockResolvedValue(state);
  bridge.linkStudioFolder.mockResolvedValue(state);
  bridge.getAccountState.mockResolvedValue({ status: 'signed-out' });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

// Signed out and with no add-on, every test starts as a member again.
afterEach(() => {
  resetAccountStore();
  resetRendererAddons();
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
  /**
   * The account known before the dialog opens, as it is in the Studio, where
   * the window asked at launch: a case that does not wait on anything else
   * ended before the dialog's own question was answered, which re-rendered it
   * outside act. Set the account's answer first; the reset after each case
   * lets the subscription go.
   */
  const accountKnown = async () => {
    subscribeAccount(() => undefined);
    await act(async () => undefined);
  };

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

  // A first publication's line in every language, as the chat writes it
  // (Ivan, 2026-11-13: required "even on first version").
  const FIRST_LINE = notesAsWritten('Neon rain over the signs');
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
        draft={draft({ suggestedNotes: FIRST_LINE })}
        running={false}
        onPublish={onPublish}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    // A member's scene waits for review first, and the dialog says so
    // before the press, not after it.
    expect(screen.getByText('studio.publish.pointReview')).toBeInTheDocument();
    // And that the review can say no, and what is left of the scene then.
    expect(screen.getByText('studio.publish.pointQuality')).toBeInTheDocument();
    const go = screen.getByRole('button', { name: 'studio.publish.goReview' });
    // Held while the category is missing, and the press goes there.
    expect(go).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.category.space' }),
    );
    expect(go).toBeEnabled();
    expect(go).not.toHaveAttribute('aria-disabled');
    await userEvent.click(go);
    expect(onPublish).toHaveBeenCalledWith(
      'space',
      undefined,
      FIRST_LINE,
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
    );
  });

  // An add-on (`renderer/addons.ts`) can say this account's publications go
  // straight out; the test above, with none, is its control.
  it('publishes straight to the gallery when an add-on says the account needs no review', async () => {
    bridge.getAccountState.mockResolvedValue({
      status: 'signed-in',
      identity: { id: PUBLISHER },
    });
    let straight = false;
    const listeners = new Set<() => void>();
    const refresh = jest.fn(() => {
      straight = true;
      listeners.forEach((listener) => listener());
    });
    registerRendererAddon({
      name: 'test-addon',
      refresh,
      capabilities: {
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        get: () => ({ publishesWithoutReview: straight }),
      },
    });
    const onPublish = jest.fn();
    render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({ suggestedNotes: FIRST_LINE })}
        running={false}
        onPublish={onPublish}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    // Asked on opening, for the account signed in: the answer the dialog
    // opened with may have been a failure.
    const go = await screen.findByRole('button', { name: 'studio.publish.go' });
    expect(refresh).toHaveBeenCalled();
    expect(
      screen.queryByText('studio.publish.pointReview'),
    ).not.toBeInTheDocument();
    // Nothing reviews it, so nothing can turn it down.
    expect(
      screen.queryByText('studio.publish.pointQuality'),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.category.space' }),
    );
    await userEvent.click(go);
    expect(onPublish).toHaveBeenCalledWith(
      'space',
      undefined,
      FIRST_LINE,
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
    );
  });

  it('asks an update what is new, and sends it with the publication', async () => {
    const onPublish = jest.fn();
    const onTranslateNote = jest.fn().mockResolvedValue(false);
    const published = {
      sceneId: 'neon-city',
      version: 3,
      category: 'cities',
    } as IPublishDraft['published'];
    const dialog = (extra: Partial<IPublishDraft> = {}) => (
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({ published, ...extra })}
        running={false}
        onPublish={onPublish}
        onTranslateNote={onTranslateNote}
        onCancel={jest.fn()}
      />
    );
    const { rerender } = render(dialog());
    const note = screen.getByLabelText(/studio.publish.note /);
    expect(note).toHaveAttribute('maxLength', String(MAX_VERSION_NOTE));
    // An update waits too, while everybody keeps the version they have.
    expect(
      screen.getByText('studio.publish.pointReviewUpdate'),
    ).toBeInTheDocument();
    expect(screen.getByText('studio.publish.pointQuality')).toBeInTheDocument();
    await userEvent.type(note, 'The peaks stay whole');
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goReviewUpdate' }),
    );
    // The other eleven languages are asked of the scene's chat first.
    expect(onTranslateNote).toHaveBeenCalledWith('The peaks stay whole', 'en');
    expect(onPublish).not.toHaveBeenCalled();
    // No chat could take it: the line goes in every language as written.
    rerender(dialog({ noteAsWritten: true }));
    expect(
      screen.getByText('studio.publish.noteNotTranslated'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goReviewUpdate' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith(
      'cities',
      undefined,
      notesAsWritten('The peaks stay whole'),
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
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
        draft={draft({ suggestedNotes: FIRST_LINE })}
        running={false}
        onPublish={onPublish}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
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
      screen.getByRole('button', { name: 'studio.publish.goReview' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith(
      'cities',
      'space',
      FIRST_LINE,
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
    );
    // Unpicking the first moves the second up.
    await userEvent.click(chip('cities'));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goReview' }),
    );
    expect(onPublish).toHaveBeenLastCalledWith(
      'space',
      undefined,
      FIRST_LINE,
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
    );
  });

  // The number shown is the number the press sends: above what the scene was
  // ever out at (server migration 0039), not only above a live row — an
  // unpublished scene has none, and its members still hold its number.
  it('names the version this publication will go out as', async () => {
    await accountKnown();
    const { rerender } = render(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({ held: 7 })}
        running={false}
        onPublish={jest.fn()}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('studio.publish.version:8')).toBeInTheDocument();
    rerender(
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft()}
        running={false}
        onPublish={jest.fn()}
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    // Never out: the first version, whatever the project's file says.
    expect(screen.getByText('studio.publish.version:1')).toBeInTheDocument();
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
        onTranslateNote={jest.fn().mockResolvedValue(false)}
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
        onTranslateNote={jest.fn().mockResolvedValue(false)}
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

  it('asks for the agreement the first time, and starts an update on its category', async () => {
    await accountKnown();
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
        onTranslateNote={jest.fn().mockResolvedValue(false)}
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
    const go = screen.getByRole('button', {
      name: 'studio.publish.agreeReview',
    });
    const field = screen.getByLabelText(/studio.publish.note /);
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
    // Handed to the chat for the other languages before anything goes.
    expect(onPublish).not.toHaveBeenCalled();
  });

  // Ivan, 2026-11-12: "when the AI is writing What's new the user can hit
  // Send for review, and when that thing is done the window closes ... It
  // needs to keep open, update the note text and enable the Send for review
  // button at that last moment".
  const waitingDialog = (
    onPublish: jest.Mock,
    onTranslateNote = jest.fn().mockResolvedValue(true),
  ) => {
    const published = {
      sceneId: 'neon-city',
      version: 3,
      category: 'cities',
    } as IPublishDraft['published'];
    const dialog = (extra: Partial<IPublishDraft> = {}) => (
      <StudioPublishDialog
        name="Neon City"
        identity={CITY}
        pack={pack}
        tuning={{}}
        onCapture={jest.fn()}
        onChoose={jest.fn()}
        draft={draft({ published, ...extra })}
        running={false}
        onPublish={onPublish}
        onTranslateNote={onTranslateNote}
        onCancel={jest.fn()}
      />
    );
    const send = () =>
      screen.getByRole('button', { name: 'studio.publish.goReviewUpdate' });
    return { dialog, send };
  };

  it('holds Send while the chat translates, fills the boxes when it ends, and sends only on the member’s press', async () => {
    const onPublish = jest.fn();
    const { dialog, send } = waitingDialog(onPublish);
    const { rerender } = render(dialog());
    await userEvent.type(
      screen.getByLabelText(/studio.publish.note /),
      'The peaks stay whole',
    );
    await userEvent.click(send());
    rerender(dialog({ noteTranslating: true }));
    // Shown from the press, Send held, with a way out that sends nothing.
    expect(
      screen.getByText('studio.publish.noteTranslating:11'),
    ).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'studio.publish.noteStopWaiting' }),
    ).toBeInTheDocument();
    // The reply ends with every language written for the member's line.
    const written = {
      ...notesAsWritten('The peaks stay whole'),
      es: 'Los picos quedan enteros',
      de: 'Die Gipfel bleiben ganz',
    };
    rerender(
      dialog({
        suggestedNotes: written,
        noteTranslating: false,
        noteTranslated: true,
      }),
    );
    // Nothing went on its own, and the dialog is still there to read.
    expect(onPublish).not.toHaveBeenCalled();
    // Translated, so nothing says it goes as written.
    expect(
      screen.queryByText('studio.publish.noteNotTranslated'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/studio.publish.note /)).toHaveValue(
      'The peaks stay whole',
    );
    expect(send()).toBeEnabled();
    await userEvent.click(send());
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      written,
      expect.objectContaining({ durationMs: 10000 }),
    );
  });

  it('holds Send while the chat writes the line, and gives it back with the line in the box', async () => {
    const onPublish = jest.fn();
    const { dialog, send } = waitingDialog(onPublish);
    const { rerender } = render(dialog({ noteWriting: true }));
    expect(send()).toBeDisabled();
    expect(screen.getByText('studio.publish.noteWriting')).toBeInTheDocument();
    const lines = notesAsWritten('The rain falls behind the signs');
    rerender(dialog({ noteWriting: false, suggestedNotes: lines }));
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/studio.publish.note /)).toHaveValue(lines.en);
    expect(send()).toBeEnabled();
    await userEvent.click(send());
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      lines,
      expect.objectContaining({ durationMs: 10000 }),
    );
  });

  it('keeps the member’s box and says it goes as written when the chat ends without their line', async () => {
    const onPublish = jest.fn();
    const { dialog, send } = waitingDialog(onPublish);
    const { rerender } = render(dialog());
    await userEvent.type(
      screen.getByLabelText(/studio.publish.note /),
      'The peaks stay whole',
    );
    await userEvent.click(send());
    // A reply that wrote lines for some other line is not this one's.
    rerender(
      dialog({
        suggestedNotes: notesAsWritten('An older line'),
        noteTranslated: true,
      }),
    );
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/studio.publish.note /)).toHaveValue(
      'The peaks stay whole',
    );
    expect(
      screen.getByText('studio.publish.noteNotTranslated'),
    ).toBeInTheDocument();
    expect(send()).toBeEnabled();
    await userEvent.click(send());
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      notesAsWritten('The peaks stay whole'),
      expect.objectContaining({ durationMs: 10000 }),
    );
  });

  it('stops waiting on Stop waiting without sending, and sends as written on the next press', async () => {
    const onPublish = jest.fn();
    const { dialog, send } = waitingDialog(onPublish);
    const { rerender } = render(dialog());
    await userEvent.type(
      screen.getByLabelText(/studio.publish.note /),
      'The peaks stay whole',
    );
    await userEvent.click(send());
    rerender(dialog({ noteTranslating: true }));
    await userEvent.click(
      screen.getByRole('button', { name: 'studio.publish.noteStopWaiting' }),
    );
    expect(onPublish).not.toHaveBeenCalled();
    expect(send()).toBeEnabled();
    expect(
      screen.getByText('studio.publish.noteNotTranslated'),
    ).toBeInTheDocument();
    await userEvent.click(send());
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      notesAsWritten('The peaks stay whole'),
      expect.objectContaining({ durationMs: 10000 }),
    );
    // The control: the reply ending afterwards sends nothing more.
    rerender(
      dialog({
        noteTranslating: false,
        suggestedNotes: notesAsWritten('The peaks stay whole'),
        noteTranslated: true,
      }),
    );
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  // The line the member's AI wrote about its own change, offered as the note.
  // Nobody remembers what changed three days later; the assistant that
  // changed it does, and it writes the line beside the scene.
  it('opens the note on what the AI wrote, and publishes with it', async () => {
    await accountKnown();
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
          // Written by the chat in every language, as it is asked to.
          suggestedNotes: notesAsWritten('the rain falls behind the signs now'),
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
        onTranslateNote={jest.fn().mockResolvedValue(false)}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(/studio.publish.note /)).toHaveValue(
      'the rain falls behind the signs now',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.publish.goReviewUpdate' }),
    );
    expect(onPublish).toHaveBeenCalledWith(
      'cities',
      undefined,
      notesAsWritten('the rain falls behind the signs now'),
      expect.objectContaining({ durationMs: 10000, blob: expect.any(Blob) }),
    );
  });
});
