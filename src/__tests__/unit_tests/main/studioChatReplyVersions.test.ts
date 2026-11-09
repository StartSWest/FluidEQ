/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The number each version a chat keeps is shown under (`chatVersions.ts`):
 * counted in the chat, because the scene's own number now moves only when it
 * is published, and every version between would read the same.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatEntry } from '../../../common/studioChat';
import {
  keepReplyVersion,
  nextReplyVersion,
} from '../../../main/studioChat/chatVersions';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

const reply = (id: string, over: Partial<TReply> = {}): TReply =>
  ({
    kind: 'claude',
    id,
    at: 0,
    state: 'done',
    text: '',
    steps: [],
    ...over,
  }) as TReply;

describe("the number a chat's next version shows", () => {
  it('is 1 in a chat that has kept none', () => {
    expect(nextReplyVersion([])).toBe(1);
    expect(nextReplyVersion([reply('a')])).toBe(1);
  });

  it('is one above the highest it shows, so an older chat never shows one twice', () => {
    // An older chat's versions carry the numbers pack.json had then.
    expect(
      nextReplyVersion([
        reply('a', { version: 3 }),
        reply('b'),
        reply('c', { version: 7 }),
      ]),
    ).toBe(8);
  });
});

describe('keeping the version a reply made', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-reply-version-'));
    fs.mkdirSync(path.join(root, 'project'));
    fs.writeFileSync(
      path.join(root, 'project', 'pack.json'),
      JSON.stringify({ id: 'alpine', version: 23 }),
    );
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("shows it under the chat's number, not the one in pack.json", () => {
    const wrote = reply('r1', {
      steps: [{ id: 's', kind: 'write', state: 'done', file: 'scene.frag' }],
    } as Partial<TReply>);
    expect(
      keepReplyVersion(
        wrote,
        path.join(root, 'project'),
        path.join(root, 'versions'),
        4,
      ),
    ).toBe(4);
    // The control: a reply that wrote nothing keeps no version.
    expect(
      keepReplyVersion(
        reply('r2'),
        path.join(root, 'project'),
        path.join(root, 'versions'),
        5,
      ),
    ).toBeUndefined();
  });
});
