/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A first version's line reaching the Publish dialog (Ivan, 2026-11-13:
 * "the publish screen is blocked without notes"). On a black-hole scene never
 * published, the chat was asked three times, wrote the line three ways, and
 * the box stayed empty with Send held. What is held here, each beside the
 * case that must not:
 * - a chat busy when the dialog opens refuses FluidEQ's ask, and the reply's
 *   end asks again - once;
 * - a line written while the dialog is open reaches the box at once, with
 *   no chat reply and no reopen;
 * - a line FluidEQ cannot use is said, never an empty box;
 * - a scene never published offers a description short enough to be its
 *   line; an update never does.
 */

const askStudioChatForNote = jest.fn((_ask: { first: boolean }) =>
  Promise.resolve(true),
);
jest.mock('../../../renderer/studio/chat/studioChatStore', () => ({
  askStudioChatForNote: (ask: { first: boolean }) => askStudioChatForNote(ask),
  askStudioChatToTranslateNote: () => Promise.resolve(true),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { useCallback, useRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IStudioNotes } from '../../../common/studioNotes';
import StudioPublishNote, {
  FIRST_NOTE_WORDS,
  useOfferedLines,
} from '../../../renderer/studio/StudioPublishNote';
import usePublishNote from '../../../renderer/studio/usePublishNote';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
/* eslint-enable import/first */

type TEntryListener = (change: {
  projectId: string;
  entry: TStudioChatEntry;
  busy: boolean;
}) => void;

const LINE = 'A black hole bends the starlight with the bass';

const PUBLISHED = {
  sceneId: 'black-hole',
  version: 1,
  publishedAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
} as unknown as NonNullable<IPublishDraft['published']>;

const opened = (over: Partial<IPublishDraft> = {}): IPublishDraft => ({
  shots: [],
  chosen: 0,
  agreed: true,
  missed: false,
  ...over,
});

/** The hook on a draft the test holds; the notes are the test's to change. */
const setUp = (first: IPublishDraft, initial?: IStudioNotes) => {
  let notes = initial;
  let entries: TEntryListener | undefined;
  let notesChanged: ((projectId: string) => void) | undefined;
  const readStudioNotes = jest.fn(() => Promise.resolve(notes));
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: {
      readStudioNotes,
      onStudioChatEntry: (next: TEntryListener) => {
        entries = next;
        return () => {
          entries = undefined;
        };
      },
      onStudioNotesChanged: (next: (projectId: string) => void) => {
        notesChanged = next;
        return () => {
          notesChanged = undefined;
        };
      },
    },
  };
  let shown: IPublishDraft | undefined;
  function Host() {
    const [draft, show] = useState<IPublishDraft | undefined>(first);
    const current = useRef<IPublishDraft | undefined>(first);
    const setDraft = useCallback((next: IPublishDraft | undefined) => {
      current.current = next;
      show(next);
    }, []);
    usePublishNote(draft, current, setDraft, 'project');
    shown = draft;
    return null;
  }
  render(<Host />);
  return {
    now: () => shown,
    readStudioNotes,
    write: (next: IStudioNotes) => {
      notes = next;
    },
    replyEnds: () =>
      act(async () => {
        entries?.({
          projectId: 'project',
          entry: {
            kind: 'claude',
            id: 'r',
            text: '',
            steps: [],
            state: 'done',
          },
          busy: false,
        });
      }),
    notesChange: (projectId = 'project') =>
      act(async () => {
        notesChanged?.(projectId);
      }),
  };
};

beforeEach(() => {
  askStudioChatForNote.mockReset();
  askStudioChatForNote.mockResolvedValue(true);
});

describe('FluidEQ’s ask for the line', () => {
  it('is asked again when the chat was busy as the dialog opened, once', async () => {
    askStudioChatForNote.mockResolvedValueOnce(false);
    const { now, replyEnds } = setUp(opened());
    await act(async () => undefined);
    expect(askStudioChatForNote).toHaveBeenCalledTimes(1);
    expect(now()?.noteWriting).toBeUndefined();
    // The member's own reply ends: the chat is free, and is asked now.
    await replyEnds();
    expect(askStudioChatForNote).toHaveBeenCalledTimes(2);
    expect(askStudioChatForNote).toHaveBeenLastCalledWith({ first: true });
    expect(now()?.noteWriting).toBe(true);
    // FluidEQ's own reply ends with nothing written: never asked for ever.
    await replyEnds();
    expect(askStudioChatForNote).toHaveBeenCalledTimes(2);
    expect(now()?.noteWriting).toBe(false);
  });

  it('is not asked again once it went', async () => {
    const { replyEnds } = setUp(opened());
    await act(async () => undefined);
    await replyEnds();
    expect(askStudioChatForNote).toHaveBeenCalledTimes(1);
  });
});

describe('a line written while the dialog is open', () => {
  it('reaches the box at once, with no reply and no reopen', async () => {
    const { now, write, notesChange, readStudioNotes } = setUp(opened());
    await act(async () => undefined);
    write({ description: '', whatsNew: LINE });
    await notesChange();
    expect(now()?.suggestedNotes).toEqual({ en: LINE });
    expect(now()?.noteWriting).toBe(false);
    // The control: another project's notes are not this dialog's.
    readStudioNotes.mockClear();
    await notesChange('another-project');
    expect(readStudioNotes).not.toHaveBeenCalled();
  });
});

describe('a line FluidEQ cannot use', () => {
  it('is said, never an empty box', async () => {
    const { now, write, notesChange } = setUp(opened());
    write({ description: '', whatsNewUnreadable: true });
    await notesChange();
    expect(now()?.noteUnreadable).toBe(true);
    // A usable line written after it clears the word.
    write({ description: '', whatsNew: LINE });
    await notesChange();
    expect(now()?.noteUnreadable).toBe(false);
  });

  function Box({ unreadable }: { unreadable: boolean }) {
    const [state, setState] = useOfferedLines(undefined);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    return (
      <StudioPublishNote
        words={FIRST_NOTE_WORDS}
        state={state}
        setState={setState}
        mine="en"
        running={false}
        missing={false}
        onFilled={() => undefined}
        writing={false}
        translating={undefined}
        asWritten={false}
        unreadable={unreadable}
        noteRef={noteRef}
      />
    );
  }

  it('shows the plain word in the box, and the box still takes a line', () => {
    const { rerender } = render(<Box unreadable />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.publish.noteUnreadable',
    );
    expect(
      screen.getByPlaceholderText('studio.publish.notePlaceholderFirst'),
    ).toBeEnabled();
    // The control: readable notes say nothing.
    rerender(<Box unreadable={false} />);
    expect(screen.queryByText('studio.publish.noteUnreadable')).toBeNull();
  });
});

describe('a description short enough to be the line', () => {
  it('starts a first version’s line, never an update’s', async () => {
    const first = setUp(opened(), { description: LINE });
    await first.notesChange();
    expect(first.now()?.suggestedNotes).toEqual({ en: LINE });

    const update = setUp(opened({ published: PUBLISHED }), {
      description: LINE,
    });
    await update.notesChange();
    expect(update.now()?.suggestedNotes).toBeUndefined();
  });
});
