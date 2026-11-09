/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Pictures Claude makes show in the chat (Ivan, 2026-11-09: "shows
 * generated images right there in the chat"): one written into the project
 * by a script or the member's own image tool appears right after the step
 * that wrote it (`madePictures.ts`), and a picture a step brings back itself
 * — a picture file Claude opened — stays on that step (`replyEvents.ts`),
 * where it used to be dropped unless the step was a look.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
}));
jest.mock('../../../main/studioChat/chatPicture', () => ({
  chatPictureFromBytes: jest.fn(() => 'data:image/jpeg;base64,JPEG'),
  chatPictureFromDataUrl: jest.fn(() => 'data:image/jpeg;base64,JPEG'),
  chatPictureKeepingAlpha: jest.fn(() => 'data:image/png;base64,ALPHA'),
  chatPictureKeepingAlphaBytes: jest.fn(() => 'data:image/png;base64,ALPHA'),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import createChatQueue from '../../../main/studioChat/chatQueue';
import { readStreamLine } from '../../../main/studioChat/chatStream';
import createChatTurns from '../../../main/studioChat/chatTurns';
/* eslint-enable import/first */

const PROJECT = 'project';
let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-made-'));
  fs.mkdirSync(path.join(folder, 'art'));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/** A reply running on a fake Claude Code in `folder`. */
const setUp = () => {
  const turns = createChatTurns({
    queue: createChatQueue(() => undefined),
    upsert: () => undefined,
    tell: () => undefined,
    save: () => undefined,
    saveWith: () => undefined,
    versionsOf: () => 'versions',
    dropAsks: () => undefined,
  });
  const session: IChatSession = {
    process: { write: () => undefined, end: jest.fn(), position: () => 0 },
    folder,
    brief: 'brief-key',
    model: 'default',
    effort: 'default',
    stopping: false,
    sendingNow: false,
  };
  turns.begin(PROJECT, session, [{ words: 'make a picture' }]);
  /** One line of Claude Code's stream, through the chat. */
  const stream = (line: object) =>
    readStreamLine(JSON.stringify(line)).forEach((event) => {
      if (event.type !== 'session' && event.type !== 'permission') {
        turns.onEvent(PROJECT, session, event);
      }
    });
  const reply = () =>
    session.reply as Extract<TStudioChatEntry, { kind: 'claude' }>;
  return { stream, reply };
};

const toolUse = (id: string, name: string, input: object) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', id, name, input }] },
});
const toolResult = (id: string, content: unknown, isError = false) => ({
  type: 'user',
  message: {
    content: [
      { type: 'tool_result', tool_use_id: id, content, is_error: isError },
    ],
  },
});
const write = (relative: string) =>
  fs.writeFileSync(path.join(folder, relative), Buffer.from([1, 2, 3]));
const hourAgo = (relative: string) => {
  const then = new Date(Date.now() - 3600_000);
  fs.utimesSync(path.join(folder, relative), then, then);
};

it('shows the pictures a step wrote, right after it, and nothing older', () => {
  const { stream, reply } = setUp();
  write('art/old-sky.png');
  hourAgo('art/old-sky.png');
  stream(toolUse('bash-1', 'Bash', { command: 'node make-picture.mjs' }));
  write('art/reference-tubes.png');
  write('photo.jpg');
  write('notes.txt');
  // Shown in the order they were written, whichever folder holds them.
  const later = new Date(Date.now() + 1000);
  fs.utimesSync(path.join(folder, 'photo.jpg'), later, later);
  stream(toolUse('read-1', 'Read', { file_path: 'scene.frag' }));
  stream(toolResult('bash-1', 'saved'));

  expect(
    reply().steps.map(({ kind, file, picture }) => ({ kind, file, picture })),
  ).toEqual([
    { kind: 'other', file: undefined, picture: undefined },
    {
      kind: 'picture',
      file: 'reference-tubes.png',
      picture: 'data:image/png;base64,ALPHA',
    },
    {
      kind: 'picture',
      file: 'photo.jpg',
      picture: 'data:image/jpeg;base64,JPEG',
    },
    { kind: 'read', file: 'scene.frag', picture: undefined },
  ]);
});

it('shows nothing for a step that failed, or wrote nothing new', () => {
  const { stream, reply } = setUp();
  // The control: the same picture, written before either step began.
  write('art/reference-tubes.png');
  hourAgo('art/reference-tubes.png');
  stream(toolUse('bash-1', 'Bash', { command: 'ls' }));
  stream(toolResult('bash-1', 'listed'));
  stream(toolUse('bash-2', 'Bash', { command: 'node make-picture.mjs' }));
  write('art/broken.png');
  stream(toolResult('bash-2', 'crashed', true));

  expect(reply().steps.map(({ kind }) => kind)).toEqual(['other', 'other']);
});

it('keeps the newest four a step wrote', () => {
  const { stream, reply } = setUp();
  stream(toolUse('bash-1', 'Bash', { command: 'node frames.mjs' }));
  ['a', 'b', 'c', 'd', 'e', 'f'].forEach((name, index) => {
    write(`art/${name}.png`);
    const at = new Date(Date.now() + index * 1000);
    fs.utimesSync(path.join(folder, `art/${name}.png`), at, at);
  });
  stream(toolResult('bash-1', 'saved'));

  expect(reply().steps.flatMap(({ file }) => (file ? [file] : []))).toEqual([
    'c.png',
    'd.png',
    'e.png',
    'f.png',
  ]);
});

it('keeps the picture a read of a picture file brought back', () => {
  const { stream, reply } = setUp();
  stream(toolUse('read-1', 'Read', { file_path: 'art/reference-tubes.png' }));
  stream(
    toolResult('read-1', [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0K' },
      },
    ]),
  );

  expect(reply().steps).toEqual([
    {
      id: 'read-1',
      kind: 'read',
      file: 'reference-tubes.png',
      state: 'done',
      picture: 'data:image/png;base64,ALPHA',
    },
  ]);
});
