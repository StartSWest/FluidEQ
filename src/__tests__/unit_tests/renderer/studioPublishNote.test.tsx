/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The publish dialog's "What's new" box arrives written (Ivan, 2026-11-12:
 * "I want to avoid user typing manually", "we need to load that in that
 * field if exists in notes"). Held here: a line written while the dialog is
 * open reaches the box, what the member typed is never written over, an
 * update opened with no line asks the scene's chat for one and shows it
 * being written, and every reply the chat finishes has the notes read again.
 * Each case beside the one that must not.
 */

const askStudioChatForNote = jest.fn(() => Promise.resolve(true));
jest.mock('../../../renderer/studio/chat/studioChatStore', () => ({
  askStudioChatForNote: () => askStudioChatForNote(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { useCallback, useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IStudioNotes } from '../../../common/studioNotes';
import StudioPublishNote, {
  useOfferedNote,
} from '../../../renderer/studio/StudioPublishNote';
import usePublishNote, {
  lineToOffer,
} from '../../../renderer/studio/usePublishNote';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
/* eslint-enable import/first */

function Box({
  suggested,
  writing = false,
}: {
  suggested?: string;
  writing?: boolean;
}) {
  const [note, setNote] = useOfferedNote(suggested);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <StudioPublishNote
      note={note}
      setNote={setNote}
      running={false}
      missing={false}
      onFilled={() => undefined}
      writing={writing}
      noteRef={noteRef}
    />
  );
}

const field = () => screen.getByLabelText('studio.publish.note');

describe('the note box', () => {
  it('takes a line written after it opened', () => {
    const { rerender } = render(<Box />);
    expect(field()).toHaveValue('');
    rerender(<Box suggested="The balloons rise with the bass." />);
    expect(field()).toHaveValue('The balloons rise with the bass.');
  });

  it('takes a newer line over the one it offered, untouched', () => {
    const { rerender } = render(<Box suggested="The balloons rise." />);
    rerender(<Box suggested="The balloons rise and glow at dawn." />);
    expect(field()).toHaveValue('The balloons rise and glow at dawn.');
  });

  it('never writes over what the member typed', () => {
    const { rerender } = render(<Box suggested="The balloons rise." />);
    fireEvent.change(field(), { target: { value: 'My own words' } });
    rerender(<Box suggested="The balloons rise and glow at dawn." />);
    expect(field()).toHaveValue('My own words');
  });

  it('says the line is written in English, and the field is described by it', () => {
    render(<Box />);
    const hint = screen.getByText('studio.publish.noteEnglish');
    expect(field().getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('says nothing is being written when nothing was asked', () => {
    render(<Box />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the chat is writing it while the box is empty', () => {
    const { rerender } = render(<Box writing />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.publish.noteWriting',
    );
    rerender(<Box writing suggested="The balloons rise." />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

type TEntryListener = (change: {
  projectId: string;
  entry: TStudioChatEntry;
  busy: boolean;
}) => void;

const PUBLISHED = {
  sceneId: 'balloon-dawn',
  version: 1,
  category: 'sky',
  names: { en: 'Balloon Dawn' },
  swatch: ['#000000', '#ffffff'],
  likes: 0,
  adds: 0,
  publishedAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  blocked: false,
} as unknown as NonNullable<IPublishDraft['published']>;

const opened = (over: Partial<IPublishDraft> = {}): IPublishDraft => ({
  shots: [],
  chosen: 0,
  agreed: true,
  missed: false,
  ...over,
});

/** The hook on a draft the test holds, with the chat and notes faked. */
const setUp = (first: IPublishDraft, notes?: IStudioNotes) => {
  let listener: TEntryListener | undefined;
  const readStudioNotes = jest.fn(() => Promise.resolve(notes));
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: {
      readStudioNotes,
      onStudioChatEntry: (next: TEntryListener) => {
        listener = next;
        return () => {
          listener = undefined;
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
  const replyEnds = (projectId = 'project') =>
    act(async () => {
      listener?.({
        projectId,
        entry: { kind: 'claude', id: 'r', text: '', steps: [], state: 'done' },
        busy: false,
      });
    });
  return { now: () => shown, replyEnds, readStudioNotes };
};

describe('the dialog’s line, from the chat and the notes', () => {
  beforeEach(() => askStudioChatForNote.mockClear());

  it('asks the chat for an update’s missing line, and offers it once written', async () => {
    const { now, replyEnds } = setUp(opened({ published: PUBLISHED }), {
      description: 'Balloons',
      whatsNew: 'The balloons rise with the bass.',
    });
    await act(async () => undefined);
    expect(askStudioChatForNote).toHaveBeenCalledTimes(1);
    expect(now()?.noteWriting).toBe(true);
    await replyEnds();
    expect(now()?.suggestedNote).toBe('The balloons rise with the bass.');
    expect(now()?.noteWriting).toBe(false);
  });

  it('asks nothing when the update already has its line', async () => {
    setUp(opened({ published: PUBLISHED, suggestedNote: 'Rising.' }));
    await act(async () => undefined);
    expect(askStudioChatForNote).not.toHaveBeenCalled();
  });

  it('asks nothing of a first publication', async () => {
    setUp(opened());
    await act(async () => undefined);
    expect(askStudioChatForNote).not.toHaveBeenCalled();
  });

  it('reads the notes again when any reply of the project ends, and only then', async () => {
    const { now, replyEnds, readStudioNotes } = setUp(opened(), {
      description: 'Balloons',
      whatsNew: 'The balloons glow.',
    });
    await replyEnds('another-project');
    expect(readStudioNotes).not.toHaveBeenCalled();
    expect(now()?.suggestedNote).toBeUndefined();
    await replyEnds();
    expect(now()?.suggestedNote).toBe('The balloons glow.');
  });
});

describe('a line older than the gallery’s version', () => {
  // The gallery's version went out at 2026-11-01T00:00:00Z.
  const GALLERY = Date.parse(PUBLISHED.updatedAt);
  const line = 'Last version’s line.';
  beforeEach(() => askStudioChatForNote.mockClear());

  it('is not offered', () => {
    expect(
      lineToOffer(
        { description: 'x', whatsNew: line, writtenAt: GALLERY - 1 },
        PUBLISHED,
      ),
    ).toBeUndefined();
  });

  it('is offered when written after it, or in notes stamped at publishing', () => {
    expect(
      lineToOffer(
        { description: 'x', whatsNew: line, writtenAt: GALLERY + 1 },
        PUBLISHED,
      ),
    ).toBe(line);
    expect(
      lineToOffer(
        {
          description: 'x',
          whatsNew: line,
          writtenAt: GALLERY - 1,
          published: GALLERY - 2,
        },
        PUBLISHED,
      ),
    ).toBe(line);
  });

  it('opens the update as having no line, and asks the chat for one', async () => {
    const { now, replyEnds } = setUp(opened({ published: PUBLISHED }), {
      description: 'x',
      whatsNew: line,
      writtenAt: GALLERY - 1,
    });
    await act(async () => undefined);
    expect(askStudioChatForNote).toHaveBeenCalledTimes(1);
    await replyEnds();
    expect(now()?.suggestedNote).toBeUndefined();
  });
});
