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
 * The line is held in every language (Ivan, 2026-11-12): the member's own
 * and English on show, the rest folded away. Each case beside the one that
 * must not.
 */

const askStudioChatForNote = jest.fn((_ask: { first: boolean }) =>
  Promise.resolve(true),
);
const askStudioChatToTranslateNote = jest.fn((_line: string, _from: string) =>
  Promise.resolve(true),
);
jest.mock('../../../renderer/studio/chat/studioChatStore', () => ({
  askStudioChatForNote: (ask: { first: boolean }) => askStudioChatForNote(ask),
  askStudioChatToTranslateNote: (line: string, from: string) =>
    askStudioChatToTranslateNote(line, from),
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type {
  TVersionNoteLocale,
  TVersionNotes,
} from '../../../common/sceneVersionNote';
import type { IStudioNotes } from '../../../common/studioNotes';
import StudioPublishNote, {
  UPDATE_NOTE_WORDS,
  useOfferedLines,
} from '../../../renderer/studio/StudioPublishNote';
import usePublishNote, {
  notesToOffer,
} from '../../../renderer/studio/usePublishNote';
import type { IPublishDraft } from '../../../renderer/studio/useStudioPublish';
/* eslint-enable import/first */

function Box({
  suggested,
  writing = false,
  mine = 'en',
  translating,
  asWritten = false,
}: {
  suggested?: TVersionNotes;
  writing?: boolean;
  mine?: TVersionNoteLocale;
  translating?: number;
  asWritten?: boolean;
}) {
  const [state, setState] = useOfferedLines(suggested);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <StudioPublishNote
      words={UPDATE_NOTE_WORDS}
      state={state}
      setState={setState}
      mine={mine}
      running={false}
      missing={false}
      onFilled={() => undefined}
      writing={writing}
      translating={translating}
      asWritten={asWritten}
      noteRef={noteRef}
    />
  );
}

/** The box in a language, by its own name for itself. */
const field = (language = 'English') =>
  screen.getByLabelText(new RegExp(`studio.publish.note ${language}`));
const en = (line: string): TVersionNotes => ({ en: line });

describe('the note box', () => {
  it('takes a line written after it opened', () => {
    const { rerender } = render(<Box />);
    expect(field()).toHaveValue('');
    rerender(<Box suggested={en('The balloons rise with the bass.')} />);
    expect(field()).toHaveValue('The balloons rise with the bass.');
  });

  it('takes a newer line over the one it offered, untouched', () => {
    const { rerender } = render(<Box suggested={en('The balloons rise.')} />);
    rerender(<Box suggested={en('The balloons rise and glow at dawn.')} />);
    expect(field()).toHaveValue('The balloons rise and glow at dawn.');
  });

  it('never writes over what the member typed', () => {
    const { rerender } = render(<Box suggested={en('The balloons rise.')} />);
    fireEvent.change(field(), { target: { value: 'My own words' } });
    rerender(<Box suggested={en('The balloons rise and glow at dawn.')} />);
    expect(field()).toHaveValue('My own words');
  });

  it('shows the member’s language and English, the rest folded away', () => {
    render(
      <Box
        mine="es"
        suggested={{
          en: 'The balloons rise.',
          es: 'Los globos suben.',
          ja: '気球が昇る。',
        }}
      />,
    );
    expect(field('Español')).toHaveValue('Los globos suben.');
    expect(field('English')).toHaveValue('The balloons rise.');
    // The other ten wait in the fold-out, unopened.
    expect(screen.queryByLabelText('日本語')).not.toBeInTheDocument();
    // Opened as the browser reports it; jsdom does not open one on a click.
    const more = screen
      .getByText('studio.publish.noteMore:10')
      .closest('details');
    act(() => {
      if (more) {
        more.open = true;
        fireEvent(more, new Event('toggle'));
      }
    });
    expect(screen.getByLabelText('日本語')).toHaveValue('気球が昇る。');
  });

  it('says English follows the member’s line once they change theirs', () => {
    render(
      <Box
        mine="es"
        suggested={{ en: 'The balloons rise.', es: 'Los globos suben.' }}
      />,
    );
    // The control: untouched, English is the line for any language left out.
    expect(screen.getByText('studio.publish.noteFallback')).toBeInTheDocument();
    fireEvent.change(field('Español'), {
      target: { value: 'Los globos brillan.' },
    });
    expect(screen.getByText('studio.publish.noteFollows')).toBeInTheDocument();
    expect(field('English')).toHaveClass('is-following');
  });

  it('shows English alone to a member who reads FluidEQ in English', () => {
    render(<Box suggested={en('The balloons rise.')} />);
    expect(field()).toHaveValue('The balloons rise.');
    expect(screen.getByText('studio.publish.noteMore:11')).toBeInTheDocument();
  });

  it('says the chat is translating, and when nothing could', () => {
    const { rerender } = render(<Box translating={11} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.publish.noteTranslating:11',
    );
    expect(
      screen.queryByText('studio.publish.noteNotTranslated'),
    ).not.toBeInTheDocument();
    rerender(<Box asWritten />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByText('studio.publish.noteNotTranslated'),
    ).toBeInTheDocument();
  });

  it('says nothing is being written when nothing was asked', () => {
    render(<Box />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // Send waits on the chat for as long as it writes, so the wait is said
  // that long too, a line in the box or not.
  it('says the chat is writing it for as long as it writes', () => {
    const { rerender } = render(<Box writing />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.publish.noteWriting',
    );
    rerender(<Box writing suggested={en('The balloons rise.')} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.publish.noteWriting',
    );
    rerender(<Box suggested={en('The balloons rise.')} />);
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
  let translate: ((line: string, from: string) => Promise<boolean>) | undefined;
  function Host() {
    const [draft, show] = useState<IPublishDraft | undefined>(first);
    const current = useRef<IPublishDraft | undefined>(first);
    const setDraft = useCallback((next: IPublishDraft | undefined) => {
      current.current = next;
      show(next);
    }, []);
    translate = usePublishNote(draft, current, setDraft, 'project').translate;
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
  return {
    now: () => shown,
    replyEnds,
    readStudioNotes,
    translate: (line: string, from: string) =>
      act(async () => {
        await translate?.(line, from);
      }),
  };
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
    expect(askStudioChatForNote).toHaveBeenCalledWith({ first: false });
    expect(now()?.noteWriting).toBe(true);
    await replyEnds();
    expect(now()?.suggestedNotes).toEqual(
      en('The balloons rise with the bass.'),
    );
    expect(now()?.noteWriting).toBe(false);
  });

  it('asks nothing when the update already has its line', async () => {
    setUp(opened({ published: PUBLISHED, suggestedNotes: en('Rising.') }));
    await act(async () => undefined);
    expect(askStudioChatForNote).not.toHaveBeenCalled();
  });

  // Ivan, 2026-11-13: the line is required "even on first version", and it
  // arrives written there too — what the scene is, not what changed.
  it('asks the chat for a first publication’s line too, as a first version', async () => {
    const { now } = setUp(opened());
    await act(async () => undefined);
    expect(askStudioChatForNote).toHaveBeenCalledWith({ first: true });
    expect(now()?.noteWriting).toBe(true);
  });

  it('reads the notes again when any reply of the project ends, and only then', async () => {
    const { now, replyEnds, readStudioNotes } = setUp(opened(), {
      description: 'Balloons',
      whatsNew: 'The balloons glow.',
    });
    await replyEnds('another-project');
    expect(readStudioNotes).not.toHaveBeenCalled();
    expect(now()?.suggestedNotes).toBeUndefined();
    await replyEnds();
    expect(now()?.suggestedNotes).toEqual(en('The balloons glow.'));
  });
});

describe('the line in every language, from the notes', () => {
  beforeEach(() => askStudioChatToTranslateNote.mockClear());

  it('offers every language the notes hold', async () => {
    const lines = { en: 'The balloons glow.', es: 'Los globos brillan.' };
    const { now, replyEnds } = setUp(opened(), {
      description: 'Balloons',
      whatsNew: lines.en,
      whatsNewLines: lines,
    });
    await replyEnds();
    expect(now()?.suggestedNotes).toEqual(lines);
  });

  it('marks a translation ended at the reply’s end, and only after asking', async () => {
    const { now, replyEnds } = setUp(opened(), {
      description: 'Balloons',
      whatsNew: 'The balloons glow.',
    });
    await replyEnds();
    // The control: an ordinary reply is not a translation ending.
    expect(now()?.noteTranslated).toBeUndefined();
  });

  it('asks the chat to translate the member’s line, and marks its reply’s end', async () => {
    const lines = { en: 'Peaks glow.', es: 'Los picos brillan.' };
    const { now, replyEnds, translate } = setUp(opened(), {
      description: 'Peaks',
      whatsNew: lines.en,
      whatsNewLines: lines,
    });
    await translate('Los picos brillan.', 'es');
    expect(askStudioChatToTranslateNote).toHaveBeenCalledWith(
      'Los picos brillan.',
      'es',
    );
    expect(now()?.noteTranslating).toBe(true);
    await replyEnds();
    expect(now()).toMatchObject({
      noteTranslating: false,
      noteTranslated: true,
      suggestedNotes: lines,
    });
  });

  it('says the line goes as written when no chat can take it', async () => {
    askStudioChatToTranslateNote.mockResolvedValueOnce(false);
    const { now, translate } = setUp(opened());
    await translate('Los picos brillan.', 'es');
    expect(now()?.noteAsWritten).toBe(true);
    expect(now()?.noteTranslating).toBeUndefined();
  });
});

describe('a line older than the gallery’s version', () => {
  // The gallery's version went out at 2026-11-01T00:00:00Z.
  const GALLERY = Date.parse(PUBLISHED.updatedAt);
  const line = 'Last version’s line.';
  beforeEach(() => askStudioChatForNote.mockClear());

  it('is not offered', () => {
    expect(
      notesToOffer(
        { description: 'x', whatsNew: line, writtenAt: GALLERY - 1 },
        PUBLISHED,
      ),
    ).toBeUndefined();
  });

  it('is offered when written after it, or in notes stamped at publishing', () => {
    expect(
      notesToOffer(
        { description: 'x', whatsNew: line, writtenAt: GALLERY + 1 },
        PUBLISHED,
      ),
    ).toEqual(en(line));
    expect(
      notesToOffer(
        {
          description: 'x',
          whatsNew: line,
          writtenAt: GALLERY - 1,
          published: GALLERY - 2,
        },
        PUBLISHED,
      ),
    ).toEqual(en(line));
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
    expect(now()?.suggestedNotes).toBeUndefined();
  });
});
