/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The message a member is writing to Claude, kept on disk per project until
 * it is sent (`chatDraft.ts`; Ivan, 2026-10-26: "the app restarted and I lost
 * the message — save it per scene"). Each case reads the draft back the way
 * a restarted app does: from the files, through a fresh keeper.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { flushPendingWrites } from '../../../main/asyncWriter';
import createChatDrafts, {
  type IStudioChatDraft,
} from '../../../main/studioChat/chatDraft';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
/** A JPEG's first bytes, then anything. */
const PICTURE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

type TListener = (arg: unknown) => unknown;

/** Holds `root` and nothing else: a draft that escaped would land here. */
let outer: string;
let root: string;

/** A keeper on `root`, as main makes one at launch; its two handlers. */
const keeper = () => {
  const handlers = new Map<string, TListener>();
  createChatDrafts({
    root,
    handle: <T>(
      channel: string,
      _refused: T,
      listener: (arg: unknown) => T,
    ) => {
      handlers.set(channel, listener);
    },
  });
  const handler = (channel: string) => {
    const found = handlers.get(channel);
    if (!found) {
      throw new Error(`${channel} is not handled`);
    }
    return found;
  };
  return {
    change: async (change: unknown) => {
      handler('studio-chat-draft-change')(change);
      await flushPendingWrites();
    },
    read: (projectId: string) =>
      handler('studio-chat-draft')(projectId) as Promise<
        IStudioChatDraft | undefined
      >,
  };
};

beforeEach(() => {
  outer = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-chat-draft-'));
  root = path.join(outer, 'studio-chat');
  fs.mkdirSync(root);
});

afterEach(() => {
  fs.rmSync(outer, { recursive: true, force: true });
});

it('gives back the words after a restart', async () => {
  await keeper().change({ projectId: A, text: 'make the ring pulse' });
  expect(await keeper().read(A)).toEqual({ text: 'make the ring pulse' });
});

it('keeps each project its own words', async () => {
  const drafts = keeper();
  await drafts.change({ projectId: A, text: 'for A' });
  await drafts.change({ projectId: B, text: 'for B' });
  const restarted = keeper();
  expect(await restarted.read(A)).toEqual({ text: 'for A' });
  expect(await restarted.read(B)).toEqual({ text: 'for B' });
});

it('ends on the newest words when changes come faster than the disk', async () => {
  const drafts = keeper();
  await drafts.change({ projectId: A, text: 'kept from before' });
  ['m', 'ma', 'mak', 'make'].forEach((text) =>
    drafts.change({ projectId: A, text }).catch(() => undefined),
  );
  await flushPendingWrites();
  expect(await keeper().read(A)).toEqual({ text: 'make' });
});

it('keeps the stage picture, marks and all, beside the words', async () => {
  const drafts = keeper();
  await drafts.change({ projectId: A, text: 'this, but red' });
  await drafts.change({ projectId: A, stage: PICTURE });
  const kept = await keeper().read(A);
  expect(kept?.text).toBe('this, but red');
  expect(Array.from(kept?.stage ?? [])).toEqual(Array.from(PICTURE));
});

it('removes what was sent or emptied', async () => {
  const drafts = keeper();
  await drafts.change({ projectId: A, text: 'going now', stage: PICTURE });
  await drafts.change({ projectId: A, text: '', stage: null });
  expect(await keeper().read(A)).toEqual({ text: '' });
  expect(fs.readdirSync(path.join(root, A))).toEqual([]);
});

it('refuses a picture that is not a JPEG', async () => {
  await keeper().change({
    projectId: A,
    text: 'words',
    stage: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  expect(fs.readdirSync(path.join(root, A))).toEqual(['draft.json']);
  expect(await keeper().read(A)).toEqual({ text: 'words' });
});

it('writes nothing for a project that is not a project id', async () => {
  const drafts = keeper();
  await drafts.change({ projectId: '..', text: 'outside' });
  await drafts.change({ projectId: '../escape', text: 'outside' });
  expect(fs.readdirSync(outer)).toEqual(['studio-chat']);
  expect(fs.readdirSync(root)).toEqual([]);
  expect(await drafts.read('..')).toBeUndefined();
});
