/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The first menu opened in the Studio's chat after the window loads
 * (2026-11-09): it shut at once, the conversation jumped back to the top, and
 * the second open was fine. The window's columns rise in once at launch from
 * opacity 0, a window without the focus holds that fade until its first
 * input, and the bench counted itself unseen through it — so the sound panel
 * stayed unfolded, the bench measured under the chat column's 880px and the
 * chat sat in its tab, until the first press finished the fade, folded the
 * panel and moved the chat to its column, rebuilding it.
 *
 * Played here: the fade (`checkVisibility` answering false for opacity until
 * it ends, and its `animationend`), and the bench's width, which is what the
 * sound panel folding changes.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import type { IStudioProject } from '../../../main/ipc/memberScenes';
import StudioBench from '../../../renderer/studio/StudioBench';
import {
  resetStudioStore,
  type IStudioView,
} from '../../../renderer/studio/studioStore';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { useSoundPaneFolded } from '../../../renderer/utils/soundPane';
import { memberPack } from '../../utils/memberSceneFixtures';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));

jest.mock('../../../renderer/studio/StudioStageSound', () => ({
  __esModule: true,
  default: ({ controls }: { controls?: import('react').ReactNode }) => (
    <div>
      <canvas data-testid="studio-stage" />
      {controls}
    </div>
  ),
}));

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
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
    mayAddProject: true,
    projectsRoot: 'D:\\Studio',
    projects: [project],
    activeId: project.id,
  },
};

/** The launch fade: opacity 0 on an ancestor until it ends. */
let fading = true;
/** The sound panel as the shell lays it out. */
const pane = { folded: false };
/** How wide the window leaves the bench, measured in the running window. */
let room: 'wide' | 'narrow' = 'wide';

const benchWidth = () => {
  if (room === 'narrow') {
    return 566;
  }
  return pane.folded ? 1142 : 848;
};

interface IWatch {
  callback: ResizeObserverCallback;
  element: Element;
  observer: ResizeObserver;
}
let watches: IWatch[] = [];

/** The bench's own watch; anything else in it measured nothing here. */
class BenchResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    if (element.classList.contains('studio-bench')) {
      watches.push({
        callback: this.callback,
        element,
        observer: this as unknown as ResizeObserver,
      });
    }
  }

  unobserve() {
    watches = watches.filter(({ observer }) => observer !== this);
  }

  disconnect() {
    this.unobserve();
  }
}

/** A layout pass: the bench's watch hears its width as it now stands. */
const layout = () => {
  act(() => {
    watches.forEach(({ callback, observer }) =>
      callback(
        [{ contentRect: { width: benchWidth() } } as ResizeObserverEntry],
        observer,
      ),
    );
  });
};

/** Keeps `pane` on what the shell would draw. */
function SoundPane() {
  const folded = useSoundPaneFolded();
  useEffect(() => {
    pane.folded = folded;
  }, [folded]);
  return null;
}

beforeEach(() => {
  fading = true;
  room = 'wide';
  watches = [];
  resetStudioStore();
  resetStudioChatStore();
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: BenchResizeObserver,
  });
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: (options?: CheckVisibilityOptions) =>
      !(fading && options?.opacityProperty),
  });
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

afterEach(() => {
  Reflect.deleteProperty(window, 'ResizeObserver');
  Reflect.deleteProperty(Element.prototype, 'checkVisibility');
});

/**
 * The open model menu's rows. Not the `menu` role: the closed dropdown's
 * trigger carries that one too.
 */
const modelRows = () => screen.queryAllByRole('menuitem');

/**
 * The window loaded without the focus: the fade still holds, the conversation
 * is scrolled down, and the member opens the model menu, which is the press
 * that lets the fade finish.
 */
const openFirstMenu = async () => {
  const user = userEvent.setup();
  const { container } = render(
    <>
      <SoundPane />
      <StudioBench view={view} onShowGraph={jest.fn()} />
    </>,
  );
  await screen.findByRole('textbox', { name: 'studioChat.label' });
  layout();
  const chat = screen.getByRole('region', { name: 'studioChat.label' });
  const thread = chat.querySelector('.studio-chat__thread');
  if (!(thread instanceof HTMLElement)) {
    throw new Error('the chat has no thread');
  }
  thread.scrollTop = 1018;
  await user.click(screen.getByLabelText('studioChat.model'));
  expect(modelRows()).not.toHaveLength(0);
  return { container, chat, thread };
};

/** The press finished the launch fade, and the window laid itself out again. */
const fadeEnds = (container: HTMLElement) => {
  fading = false;
  fireEvent.animationEnd(container);
  layout();
};

describe("the Studio chat's first menu after launch", () => {
  it('stays open on the same chat, scrolled where it was, when the launch fade ends', async () => {
    const { container, chat, thread } = await openFirstMenu();

    fadeEnds(container);

    expect(chat).toBeInTheDocument();
    expect(thread.scrollTop).toBe(1018);
    expect(modelRows()).not.toHaveLength(0);
    // In its column all along: the bench stood in its place through the
    // fade, so the panel was folded from the first layout.
    expect(container.querySelector('.studio-bench__chat')).toContainElement(
      chat,
    );
  });

  // The control: the same probes catch a chat that is rebuilt, when the
  // bench really does lose its room and the chat has to leave its column.
  it('is rebuilt in its tab, and the probes see it, when the window really narrows', async () => {
    const { container, chat } = await openFirstMenu();

    room = 'narrow';
    fadeEnds(container);
    // The rebuilt chat asks Claude Code and the conversation again.
    await act(async () => {
      await Promise.resolve();
    });

    expect(chat).not.toBeInTheDocument();
    const moved = screen.getByRole('region', { name: 'studioChat.label' });
    expect(container.querySelector('.studio-bench__chat')).toBeNull();
    expect(moved.querySelector('.studio-chat__thread')?.scrollTop).toBe(0);
    expect(modelRows()).toHaveLength(0);
  });
});
