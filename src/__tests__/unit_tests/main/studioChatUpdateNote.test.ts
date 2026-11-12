/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The update note is part of how a chat's turn ends, not a line of the brief
 * the AI may forget (Ivan, 2026-11-12: "see agent still not able to write
 * notes on updates"). Held on a real scene folder: a turn that changed a
 * scene in the gallery and left its note as it was is followed by FluidEQ
 * asking for it, in a reply of its own and never in the member's name; each
 * case that asks stands beside the same turn that must not.
 */

jest.mock('../../../main/studioChat/chatPicture', () => ({
  chatPictureFromBytes: jest.fn(() => 'data:image/jpeg;base64,AA=='),
  chatPictureFromDataUrl: jest.fn(() => 'data:image/jpeg;base64,AA=='),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import createChatQueue from '../../../main/studioChat/chatQueue';
import createChatTurns from '../../../main/studioChat/chatTurns';
import { noteDue, VERSION_NOTE_ASK } from '../../../main/studioChat/noteDue';
import {
  clearVersionNote,
  readStudioNotes,
} from '../../../main/ipc/studioNotes';
/* eslint-enable import/first */

const PROJECT = 'project';
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-note-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

interface IWritten {
  type: string;
  message?: { content: { type: string; text?: string }[] };
}

const put = (folder: string, name: string, text: string) =>
  fs.writeFileSync(path.join(folder, name), text);

/** A scene folder with its notes, and a chat on a fake Claude Code. */
const setUp = ({ published = true }: { published?: boolean } = {}) => {
  const folder = path.join(root, 'scene');
  fs.mkdirSync(folder);
  put(folder, 'pack.json', '{"id":"balloon-dawn"}');
  put(folder, 'scene.frag', 'void main() {}');
  put(folder, 'studio-notes.json', '{"schema":1,"description":"Balloons"}');
  const lines: IWritten[] = [];
  const entries: TStudioChatEntry[] = [];
  const queue = createChatQueue(() => undefined);
  const turns = createChatTurns({
    queue,
    upsert: (_projectId, entry) => {
      const at = entries.findIndex(({ id }) => id === entry.id);
      if (at === -1) {
        entries.push(entry);
      } else {
        entries[at] = entry;
      }
    },
    tell: () => undefined,
    save: () => undefined,
    saveWith: () => undefined,
    versionsOf: () => path.join(root, 'versions'),
    entriesOf: () => entries,
    dropAsks: () => undefined,
    isPublished: (asked) => published && asked === folder,
  });
  const session: IChatSession = {
    process: {
      write: (line: string) => {
        lines.push(JSON.parse(line) as IWritten);
      },
      end: jest.fn(),
      position: () => lines.length,
    },
    folder,
    brief: 'brief-key',
    model: 'default',
    effort: 'default',
    stopping: false,
    sendingNow: false,
  };
  const said = () =>
    lines
      .filter(({ type }) => type === 'user')
      .map(({ message }) =>
        (message?.content ?? []).map(({ text }) => text ?? '').join(''),
      );
  const turn = (change: () => void) => {
    turns.begin(PROJECT, session, [{ words: 'make the balloons rise' }]);
    change();
    turns.onEvent(PROJECT, session, { type: 'end' });
  };
  return { folder, entries, turns, session, said, turn };
};

const asks = (said: string[]) =>
  said.filter((words) => words === VERSION_NOTE_ASK).length;

describe('a chat turn that changed a scene in the gallery', () => {
  it('is followed by FluidEQ asking for the update note', () => {
    const { folder, said, turn, session } = setUp();
    turn(() => put(folder, 'scene.frag', 'void main() { rise(); }'));
    expect(said()).toEqual(['make the balloons rise', VERSION_NOTE_ASK]);
    expect(session.askingNote).toBe(true);
  });

  it('asks nothing when the turn wrote the note', () => {
    const { folder, said, turn } = setUp();
    turn(() => {
      put(folder, 'scene.frag', 'void main() { rise(); }');
      put(
        folder,
        'studio-notes.json',
        '{"description":"Balloons","whatsNew":"The balloons rise with the bass."}',
      );
    });
    expect(said()).toEqual(['make the balloons rise']);
  });

  it('asks nothing when the scene did not change', () => {
    const { said, turn } = setUp();
    turn(() => undefined);
    expect(said()).toEqual(['make the balloons rise']);
  });

  it('asks nothing of a scene that was never published', () => {
    const { folder, said, turn } = setUp({ published: false });
    turn(() => put(folder, 'scene.frag', 'void main() { rise(); }'));
    expect(said()).toEqual(['make the balloons rise']);
  });

  it('asks once: the end of its own ask is not followed by another', () => {
    const { folder, said, turn, turns, session } = setUp();
    turn(() => put(folder, 'scene.frag', 'void main() { rise(); }'));
    put(folder, 'scene.frag', 'void main() { rise(); glow(); }');
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(asks(said())).toBe(1);
    expect(session.askingNote).toBe(false);
  });

  it('shows the ask as FluidEQ’s reply, never as a message of the member’s', () => {
    const { folder, entries, turn } = setUp();
    turn(() => put(folder, 'scene.frag', 'void main() { rise(); }'));
    expect(
      entries.filter((entry) => entry.kind === 'me').map(({ text }) => text),
    ).not.toContain(VERSION_NOTE_ASK);
  });

  it('judges a stopped turn with the next good end', () => {
    const { folder, said, turns, session } = setUp();
    turns.begin(PROJECT, session, [{ words: 'make the balloons rise' }]);
    put(folder, 'scene.frag', 'void main() { rise(); }');
    session.stopping = true;
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(asks(said())).toBe(0);
    turns.begin(PROJECT, session, [{ words: 'and slower' }]);
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(asks(said())).toBe(1);
  });
});

describe('the publish dialog asking the chat for the note', () => {
  it('asks at once when nothing is running', () => {
    const { said, turns, session } = setUp();
    expect(turns.askForNote(PROJECT, session)).toBe(true);
    expect(said()).toEqual([VERSION_NOTE_ASK]);
  });

  it('asks once, even over a turn still owing its note', () => {
    const { folder, said, turns, session } = setUp();
    turns.begin(PROJECT, session, [{ words: 'make the balloons rise' }]);
    put(folder, 'scene.frag', 'void main() { rise(); }');
    session.stopping = true;
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(turns.askForNote(PROJECT, session)).toBe(true);
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(asks(said())).toBe(1);
  });

  it('leaves it to the running reply’s end', () => {
    const { said, turns, session } = setUp();
    turns.begin(PROJECT, session, [{ words: 'make the balloons rise' }]);
    expect(turns.askForNote(PROJECT, session)).toBe(false);
    expect(asks(said())).toBe(0);
  });
});

describe('when a note is due', () => {
  const mark = (scene: string | undefined, line?: string) => ({
    scene,
    line,
  });
  it('is due for a changed scene with the same note', () => {
    expect(noteDue(mark('a'), mark('b'))).toBe(true);
    expect(noteDue(mark('a', 'old'), mark('b', 'old'))).toBe(true);
  });
  it('is not due once the note moved, the scene stayed, or nothing was read', () => {
    expect(noteDue(mark('a'), mark('b', 'new'))).toBe(false);
    expect(noteDue(mark('a'), mark('a'))).toBe(false);
    expect(noteDue(mark(undefined), mark('b'))).toBe(false);
    expect(noteDue(mark('a'), mark(undefined))).toBe(false);
  });
});

describe('the note once its version went out', () => {
  it('is taken from the notes, and the description stays', () => {
    const { folder } = setUp();
    put(
      folder,
      'studio-notes.json',
      '{"description":"Balloons","whatsNew":"The balloons rise."}',
    );
    expect(clearVersionNote(folder)).toBe(true);
    expect(readStudioNotes(folder)).toEqual({ description: 'Balloons' });
  });

  it('leaves notes with no line as they are', () => {
    const { folder } = setUp();
    const before = fs.readFileSync(path.join(folder, 'studio-notes.json'));
    expect(clearVersionNote(folder)).toBe(false);
    expect(fs.readFileSync(path.join(folder, 'studio-notes.json'))).toEqual(
      before,
    );
  });

  it('a note the AI wrote alone in a new notes file is read', () => {
    const { folder } = setUp();
    put(folder, 'studio-notes.json', '{"whatsNew":"The balloons rise."}');
    expect(readStudioNotes(folder)?.whatsNew).toBe('The balloons rise.');
    // Control: notes whose description is not text are still refused.
    put(
      folder,
      'studio-notes.json',
      '{"description":7,"whatsNew":"The balloons rise."}',
    );
    expect(readStudioNotes(folder)).toBeUndefined();
  });
});
